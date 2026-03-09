# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -Pn -n -sCV -oN versiones.nmap $IP

PORT   STATE SERVICE VERSION
22/tcp  open  ssh      OpenSSH 8.2p1 Ubuntu 4ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 50:59:4e:e8:5a:02:05:55:5d:97:63:bd:8a:88:18:f5 (RSA)
|   256 40:c8:5b:12:87:2e:ef:98:2b:4c:ef:21:9c:b9:c7:11 (ECDSA)
|_  256 96:1f:39:82:ba:17:6c:80:d4:37:e7:fe:ad:09:c0:a5 (ED25519)
80/tcp  open  http     Apache httpd 2.4.41 ((Ubuntu))
|_http-title: Did not follow redirect to https://futurevera.thm/
|_http-server-header: Apache/2.4.41 (Ubuntu)
443/tcp open  ssl/http Apache httpd 2.4.41 ((Ubuntu))
|_ssl-date: TLS randomness does not represent time
| ssl-cert: Subject: commonName=futurevera.thm/organizationName=Futurevera/stateOrProvinceName=Oregon/countryName=US
| Not valid before: 2022-03-13T10:05:19
|_Not valid after:  2023-03-13T10:05:19
| tls-alpn: 
|_  http/1.1
|_http-server-header: Apache/2.4.41 (Ubuntu)
|_http-title: FutureVera
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

Los puertos `22, 80 y 443` se encuentran abiertos. Cuando tratamos de conectarnos por `curl` a la IP usando HTTP se nos redirige a `https://futurevera.thm/`. Para conectarnos de forma más cómoda incluimos esta relación de `IP - Dominio` en `/etc/hosts`.

```bash
sudo vim /etc/hosts
$IP    futurevera.thm
```

Tras esto, nuestro sistema ya podrá resolver el nombre de dominio `futurevera.thm` y no tendremos que estar usando la dirección IP.

>[!important]
>El certificado SSL del dominio `futurevera.thm` está caducado y por lo tanto se nos marca como inseguro. Esto nos dará problemas si queremos usar la herramienta `curl` para realizar peticiones HTTPS al dominio.
>
>Para que `curl` no nos ponga trabas a la hora de realizar las peticiones debemos de usar la flag `-k`:
>```bash
>curl -I -k https://futurevera.thm 
>```

La página web hospedada en `futurevera.thm` es una web estática y sencilla que no muestra mucha información.

Primero, me gusta mirar el certificado para ver si encuentro información útil, pero sin éxito.
>[!tip]
>Para ver el certificado desde Firefox:
>1. Hacer clic en el candado a la izquierda de la URL.
>2. Clic en _Connection not secure_
>3. Clic en _More information_
>4. Clic en _View Certificate_

## ffuf

Revisando el código fuente descubro que las imágenes se llaman desde la ubicación `assets/img/xx.jpg`. Todas las imágenes siguen un patrón numérico secuencial que van desde el `01.jpg` al `03.jpg`. Por lo que como primera técnica de reconocimiento pienso en realizar un __Predictable Resource Location__ de tipo __Sequential Enumeration__.

```bash
# Preparamos una lista con los posibles recursos
seq -w 0 99 > nums

# Realizamos el ataque usando ffuf
ffuf -c -w nums -u https://futurevera.thm/assets/img/FUZZ.jpg -fc 404

01                      [Status: 200, Size: 466611, Words: 2035, Lines: 2006, Duration: 49ms]
03                      [Status: 200, Size: 288785, Words: 3681, Lines: 1082, Duration: 50ms]
02                      [Status: 200, Size: 359171, Words: 3177, Lines: 1142, Duration: 49ms]
```

También podríamos a ver usado el comando `seq` directamente dentro del comando `ffuf`:
```bash
ffuf -c -w <(seq -w 0 99) -u https://futurevera.thm/assets/img/FUZZ.jpg -fc 404

01                      [Status: 200, Size: 466611, Words: 2035, Lines: 2006, Duration: 49ms]
03                      [Status: 200, Size: 288785, Words: 3681, Lines: 1082, Duration: 50ms]
02                      [Status: 200, Size: 359171, Words: 3177, Lines: 1142, Duration: 49ms]
```

No encontramos nada de interés. Por lo que lo siguiente que se me ocurre hacer es enumerar *endpoints*, directorios y subdominios ocultos.

### Enumeración de *endpoints* y directorios
```bash
ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-files.txt -u https://futurevera.thm/FUZZ -fc 404

ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt -u https://futurevera.thm/FUZZ -fc 404
```
No encontramos nada interesante más allá de un par de códigos __JS__ sin valor.

### Enumeración de subdominios

#### Enumeramos los subdominios que corren bajo HTTP
```bash
ffuf -c -w /usr/share/seclists/Discovery/DNS/bitquark-subdomains-top100000.txt -u http://futurevera.thm -H "Host: FUZZ.futurevera.thm" -fc 404 -fs 0

portal                  [Status: 200, Size: 69, Words: 9, Lines: 2, Duration: 2772ms]
payroll                 [Status: 200, Size: 70, Words: 9, Lines: 2, Duration: 55ms]
```

Encontramos los subdominios `portal` y `payroll`. Los añadimos al fichero `/etc/hosts` referenciándolos a la misma IP, pero se nos muestra exactamente el mismo sitio web.

#### Enumeramos los subdominios que corren bajo HTTPS
```bash
ffuf -c -w /usr/share/seclists/Discovery/DNS/bitquark-subdomains-top100000.txt -u https://futurevera.thm -H "Host: FUZZ.futurevera.thm" -fc 404 -fs 0

<snip>
file                    [Status: 200, Size: 4605, Words: 1511, Lines: 92, Duration: 46ms]
conference              [Status: 200, Size: 4605, Words: 1511, Lines: 92, Duration: 47ms]
pay                     [Status: 200, Size: 4605, Words: 1511, Lines: 92, Duration: 45ms]
<snip>
```

Aquí pasa algo interesante, en los comandos anteriores usamos las flags `-fc` y `-fs` para filtrar por códigos de estado HTTP y por el tamaño de los resultados (un resultado con un tamaño `0` indicaría que está vacío y por lo tanto sería ruido). Sin embargo, en este _fuzzing_ se nos muestra una cantidad enorme de subdominios, todos con el mismo código de estado (`200`), mismo tamaño (`4605`), etc...

Este comportamiento, sumado a que ambos subdominios HTTP encontrados nos muestra la misma web que el dominio principal, es la __"huella dactilar"__ de una configuración de tipo __Catch-all__ o __Wildcard___.
>[!tip]
>En la configuración __Catch-all__ o __Wildcard__ el servidor está configurado para decir: "_No importa qué subdominio me pidan, les voy a responder siempre con mi página genérica_".
>
>Para más información: [Explicación](#Catch\-all-o-Wildcard)

Teniendo esto en cuenta, no podemos realizar un _fuzzing_ web tradicional. Mirando la descripción del CTF vemos que se nos hace referencia a que la organización crea blogs y también tiene un área de soporte.

Podemos crear wordlists a medida para estos contextos. Personalmente me gusta crear una pequeña wordlist con las palabras que creo que pueden ser útiles y luego sumarle más palabras con alguna herramienta automatizada.
```bash
vim wordlists
# Añadimos
blog
Blog
...
support
help
IT
...

# Añadimos más de forma automatizada
cewl https://relatedwords.io/blog -d 1 >> wordlists
cewl https://relatedwords.io/support -d 1 >> wordlists
```

Con esto ya tendremos una _wordlist_ con muchas posibles palabras.
```bash
ffuf -c -w wordlists -u http://futurevera.thm -H "Host: FUZZ.futurevera.thm" -fc 404 -fs 0
# Todos los subdominios se redirigen al servicio HTTPS

# Por lo que modificamos el comando
ffuf -c -w wordlists -u https://futurevera.thm -H "Host: FUZZ.futurevera.thm" -fc 404 -fs 0
# Todos los subdominios parecen compartir el mismo código 200 y el mismo tamaño 4605

ffuf -c -w wordlists -u http://futurevera.thm -H "Host: FUZZ.futurevera.thm" -fc 404 -fs 4605
# No encuentra nada
```

>[!warning]
>Esto es muy extraño.
>
>Examinado la situación tenemos una lista de posibles subdominios que no concuerda ninguno, lo cual es improbable.
>
>Todas las respuestas son código 200 debido a al configuración __Catch-all__, por lo que me hace pensar en que si muestro todas las respuestas que no sean códigos 200, tal vez me muestre algo interesante (al responder con un código 200 y un tamaño de 4605 para todos los subdominios que no existen en realidad, si pongo alguno que no exista seguirá dando un código de estado 200 y no un 404, por lo que filtrar por todos los códigos que no sean 200 parece ser la mejor opción).
>```bash
>ffuf -c -w wordlists -u http://futurevera.thm -H "Host: FUZZ.futurevera.thm" -mc all -fc 200
>
>blog                    [Status: 421, Size: 408, Words: 38, Lines: 13, Duration: 42ms]
>blog                    [Status: 421, Size: 408, Words: 38, Lines: 13, Duration: 41ms]
>support                 [Status: 421, Size: 411, Words: 38, Lines: 13, Duration: 41ms]
>```
>- `-mc`: Muestra todos los códigos de estado (así si se devuelve un código de estado que `ffuf` filtra por defecto no tendremos problema)
>- `-fc`: Filtra para que no muestre los códigos de estado 200.
>
>Se nos muestra que existen dos subdominios con código de estado `421 (Misdirected Request)`. [Explicación](#SNI-\(Server-Name-Indication\))

Añadimos ambos subdominios al fichero `/etc/hosts` y al acceder a ellos si vemos un sitio web diferente al genérico.
## support.futurevera.thm

Si vemos el certificado del subdominio `support.futurevera.thm` vemos que existe una sección denominada `Subject Alt Names` el cual nos muestra un subdominio más (`[hidden].support.futurevera.thm`) que también sen encuetra bajo el mismo certificado SSL que `support.futurevera.thm`.

Si añadimos este subdominio a `/etc/hosts` y navegamos a él usando HTTPS, no se nos mostrará de nuevo la página genérica, pero si lo buscamos usando el protocolo HTTP se nos redirigirá a un sitio web que contiene la flag en el subdominio (por lo que podrmos verla tanto desde el navegador en la barra de direcciones URL o haciendo uso de `curl` con la flag `-I` en la sección __Location__).
```HTTP
curl -I [hidden].support.futurevera.thm

HTTP/1.1 302 Found
Date: Mon, 09 Mar 2026 23:00:01 GMT
Server: Apache/2.4.41 (Ubuntu)
Location: http://flag{[hidden]}.s3-website-us-west-3.amazonaws.com/
Content-Type: text/html; charset=UTF-8
```

---
---
# Explicaciones
## Catch-all o Wildcard

En auditorías web, es común encontrarse con una configuración de __Wildcard__ (comodín). Esta técnica se utiliza para que cualquier subdominio que no exista sea dirigido automáticamente a una dirección IP o a una página específica.
### Qué es un Wildcard?

Un __Wildcard DNS__ es un registro en la tabla de nombres que utiliza un asterisco (`*`) para actuar como comodín. Por ejemplo, si el dominio `futurevera.thm` tiene configurado un registro `*.futurevera.thm`, el servidor DNS responderá con la misma IP para:
- `mail.futurevera.thm
- `IT.futurevera.thm`
- `esto-no-existe-pero-da-ip.futurevera.thm`
### El Catch-all a nivel de Servidor Web

No basta con que el DNS responda; el servidor web (como Apache o Nginx) también debe saber qué hacer con esa petición. Una configuración **Catch-all** en el servidor significa que hay un **Virtual Host (VHost)** por defecto diseñado para "atrapar" cualquier petición que no tenga un sitio web específico asignado.

Esto suele generar confusión durante el fuzzing porque:
- __Falsos Positivos:__ Las herramientas de escaneo (como `ffuf` o `gobuster`) reportarán que __todos__ los subdominios existen porque el servidor siempre devuelve un código `200 OK` o un `302 Redirect`.
    
- __Métricas Idénticas:__ Todos estos subdominios "falsos" suelen devolver exactamente el mismo número de palabras y el mismo tamaño de respuesta (_Size_).
### Ejemplo

Durante la fase de enumeración de esta máquina, al lanzar un ataque de diccionario contra los subdominios, observamos lo siguiente:

| Subdominio       | Estado | Tamaño (Size) | Es real? |
| :--------------- | ------ | ------------- | -------- |
| `blog`           | 421    | 408           | Sí       |
| `support`        | 421    | 411           | Sí       |
| `admin`          | 200    | 4605          | No       |
| `xyz123`         | 200    | 4605          | No       |
| `esto-no-existe` | 200    | 4605          | No       |

**Análisis:** Como se observa, los subdominios inexistentes devuelven un tamaño constante de __4605 bytes__. Esto nos indica que el servidor tiene un Wildcard activo. Los subdominios `blog` y `support` destacan porque su código de estado (en este caso) y tamaño son diferentes, indicando que tienen contenido propio y configuraciones de VHost específicas.

## SNI (Server Name Indication)

Cuando realizamos ataques de fuerza bruta o fuzzing sobre servicios que utilizan __cifrado TLS/SSL (HTTPS)__, nos encontramos con un obstáculo técnico que no existe en el protocolo HTTP simple: __el handshake ocurre antes que la petición de datos.__

### Qué es el SNI

El __Server Name Indication (SNI)__ es una extensión del protocolo TLS. Su función es permitir que el cliente (nuestro navegador o `ffuf`) le diga al servidor a qué nombre de dominio intenta conectarse __durante el proceso de establecimiento de la conexión cifrada__, antes de que se envíe cualquier cabecera HTTP.
### El conflicto: Handshake vs Cabecera Host

En una conexión HTTP normal (puerto 80), el proceso es directo: abrimos la conexión y enviamos la cabecera `Host: support.futurevera.thm`. El servidor la lee y nos da la web.

En __HTTPS (puerto 443)__, el orden cambia:

1. __TCP Handshake:__ Se establece la conexión física.
    
2. __TLS Handshake (Aquí entra el SNI):__ El cliente dice "Hola, quiero una conexión segura para `futurevera.thm`". El servidor presenta su certificado SSL para ese dominio.
    
3. __Petición HTTP:__ Una vez el túnel es seguro, el cliente envía: `GET / HTTP/1.1` + `Host: support.futurevera.thm`.

### El error 421: Misdirected Request

Este error surge cuando hay una discrepancia. Si en el paso 2 (SNI) dijimos que queríamos hablar con `futurevera.thm`, pero en el paso 3 (Cabecera Host) pedimos contenido de `support.futurevera.thm`, el servidor puede detectar que estamos intentando "reutilizar" una conexión segura para un dominio para el que no se validó el certificado inicialmente.

> **Resultado:** El servidor web devuelve un código de estado `421`, indicando que la petición ha sido dirigida a un servidor que no es capaz de producir una respuesta para ese nombre de dominio en esa conexión específica.

### Impacto en el Fuzzing

Durante este CTF, el uso de comandos estándar de `ffuf` como:
```bash
ffuf -u https://futurevera.thm -H "Host: FUZZ.futurevera.thm"
```

Provocó que todas las peticiones devolvieran un código `421`. Esto se debe a que `ffuf` establecía el SNI para el dominio principal, pero luego intentaba cambiar el subdominio solo en la cabecera HTTP.

**Soluciones aplicadas:**

- __Fuzzing en la URL:__ Al usar `https://FUZZ.futurevera.thm`, forzamos a la herramienta a realizar un apretón de manos TLS nuevo y correcto para cada subdominio (requiere resolución DNS previa en `/etc/hosts`). pero como no sabemos si ese subdominio existe realmente no es efectivo. 

- __Uso de Flags de SNI:__ Utilizar herramientas o parámetros que permitan sincronizar el valor del SNI con el valor de la cabecera `Host` en cada intento.

- __Filtrar por código de estado 200 y buscar coincidencias con 421:__ Al filtrar los códigos de estado HTTP `200` nos aseguramos de que no aparezca todo el ruido producido por el __Wildcard DNS__.
