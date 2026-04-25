# <font color=red>[+]</font> Reconocimiento

```bash
sudo nmap -p- -Pn -n -sS -vvv --min-rate 5000 $IP

PORT   STATE SERVICE REASON
21/tcp open  ftp     syn-ack ttl 62
22/tcp open  ssh     syn-ack ttl 62
80/tcp open  http    syn-ack ttl 62
```

```bash
sudo nmap -p 21,22,80 -Pn -n -sVC -v --min-rate 5000 -oN versiones.nmap $IP

PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 3.0.3
22/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.3 (Ubuntu Linux; protocol 2.0)
| ssh-hostkey: 
|   2048 c9:03:aa:aa:ea:a9:f1:f4:09:79:c0:47:41:16:f1:9b (RSA)
|   256 2e:1d:83:11:65:03:b4:78:e9:6d:94:d1:3b:db:f4:d6 (ECDSA)
|_  256 91:3d:e4:4f:ab:aa:e2:9e:44:af:d3:57:86:70:bc:39 (ED25519)
80/tcp open  http    Apache httpd 2.4.29 ((Ubuntu))
|_http-title: Beginning of the end
| http-methods: 
|_  Supported Methods: POST OPTIONS HEAD GET
|_http-server-header: Apache/2.4.29 (Ubuntu)
Service Info: OSs: Unix, Linux; CPE: cpe:/o:linux:linux_kernel
```
## <font color=red>[~]</font> Entorno Web

Para tener un reconocimiento inicial sobre las tecnologías que usa la web he usado `whatweb` con el cual no he descubierto demasiada información.
```bash
whatweb http://$IP
http://10.128.181.105 [200 OK] Apache[2.4.29], Country[RESERVED][ZZ], HTML5, HTTPServer[Ubuntu Linux][Apache/2.4.29 (Ubuntu)], IP[10.128.181.105], Title[Beginning of the end]
```

También he realizado una petición `GET` usando `curl` para ver de forma rápida el código fuente de la página.
```bash
curl -i http://$IP
```
Y viendo el código fuente detecto dos subdirectorios (`/images/` y `/mansionmain/`, por lo que ampliamos nuestra superficie de ataque).
### /mansionmain/

Si seguimos el flujo de trabajo que quiere el ***CTF***, entramos en el enlace hacia `/mansionmain` en el que se carga un `index.html` en el que se nos sigue contando la historia. Al final se nos pregunta dónde se encuentra la habitación desde la cual se ha escuchado un disparo. 
Sinceramente no he jugado el videojuego y desconozco si habiéndolo juagado se podría deducir. Para buscar pistas miro de nuevo el código fuente de la página y encontramos un comentario que nos indica que debemos de ir a `/diningRoom/`.
### /diningRoom/

Cuando accedemos a `/diningRoom` se nos comenta que no se encuentra nada y que deberíamos de ir a otra habitación. Además, se nos dice que hay un emblema en la pared y si queremos cogerlo:
1. Para saber a que habitación (subdirectorio) debemos ir ahora, debemos abrir de nuevo el código fuente de la página en el cual encontramos un nuevo comentario con un código en `base 64`. Para decodificarlo lo copiamos y ejecutamos el siguiente comando en la terminal:
   ```bash
   echo <código> | base64 -d
   ```
   La respuesta nos indica que debemos de ir a `/teaRoom`.
2. Si miramos de nuevo el código fuente, vemos que el enlace con el que se nos indica que cojamos el emblema nos lleva a un *endpoint* `emblem.php`. Si cargamos dicho *endpoint* se nos muestra una *flag* con el formato `emblem{MD5}`, y se nos indica que hay un hueco en el que podemos poner algo y para ello debemos de volver a `/diningRoom/`.
   
   Si volvemos a `/dinigRoom/` y recargamos la página se nos muestra un pequeño `submit` que nos pregunta para poner el emblema. Si ponemos la *flag* entera nos dice que nada pasa, si ponemos solo el hash MD5 nos dice que no pasa nada. He tratado de crackear el hash MD5 usando ***crackstation*** y ***md5decrypt.net*** sin éxito, por lo que voy a seguir por si hubiera que usar la *flag* en otro momento.
### /teaRoom/

Si vamos a `/teaRoom`, seguimos con la historia y vemos que se nos da una ganzúa (enlace) y además se nos dice que deberíamos de ir a `/artRoom/`. Volvemos a mirar el código fuente y vemos que el enlace de la ganzúa nos redirige a un *endpoint* `master_of_unlock.html`, en la cual se encuentra una nueva *flag* con el formato `lock_pick{MD5}`.
### /artRoom/

En esta sala se nos indica que hay un papel en la pared y se nos pregunta para investigarlo, si seguimos el enlace se nos redirige a un *endpoint* `MansionMap.html`, en el cual se encuentran todas las salas (*subdirectorios*) de la mansión.

Para tenerlo a mano podemos descargarlo con `curl`:
```bash
curl http://$IP/artRoom/MansionMap.html > mapa.txt

<p>Look like a map</p>

<p>Location:<br>
/diningRoom/<br>
/teaRoom/<br>
/artRoom/<br>
/barRoom/<br>
/diningRoom2F/<br>
/tigerStatusRoom/<br>
/galleryRoom/<br>
/studyRoom/<br>
/armorRoom/<br>
/attic/<br>
</p>
```

Como podemos ver, esto lo descarga pero con todas las etiquetas html y además con algunas líneas que no nos interesan. Para poder limpiar el fichero de forma eficiente podemos usar la herramienta `awk`.
```bash
awk -F'<' '/<br>/ {print $1} mapa.txt' | tail -n+2 > mapa_limpio.txt

/diningRoom/
/teaRoom/
/artRoom/
/barRoom/
/diningRoom2F/
/tigerStatusRoom/
/galleryRoom/
/studyRoom/
/armorRoom/
/attic/
```
- `-F'<'`: Establece el símbolo `<` como delimitador. De esta forma todo lo que se encuentra antes de `<br>` será considerada como la primera columna.
- `'/<br>/ ...`: Tan solo se fija en la líneas que sigan el patrón de una barra `/` seguida de `<br>`.
- `... {print $1}'`: Imprime la primera columna, que recordemos que se especificó el delimitador anteriormente.
- `tail -n+2`: Muestra a partir de la segunda línea, para saltarnos la línea vacía.

>[!important]
>Si tratamos de usar `>` para reescribir el mismo archivo en el que teníamos la lista anterior (`mapa.txt`). Cuando usamos `>` la shell ***crea*** o ***vacía*** el archivo. Esto significa que:
>1. Borraría el contenido del archivo `mapa.txt`.
>2. `awk` trataría de analizar el fichero en busca de las coincidencias que le hemos especificado, pero ya el archivo se ha vaciado, por lo que no devuelve nada.

>Una vez tenemos el mapa podemos ir revisando poco a poco los contenidos de cada sala.
### /barRoom/

En esta sala se nos indica que hay una puerta que puede abrirse usando la ganzúa que obtuvimos antes. Si la abrimos accedemos a el *bar* en el cual se encuentra un piano. También encontramos una nota que si accedemos a su enlace se nos muestra un código en ***base 32*** `NV2XG2LDL5ZWQZLFOR5TGNRSMQ3TEZDFMFTDMNLGGVRGIYZWGNSGCZLDMU3GCMLGGY3TMZL5` (lo sabemos porque solo usa letras mayúsculas (*A-Z*) y números del *2 al 7*). Podemos decodificarla usando la terminal con:
```bash
echo <código> | base32 -d
```
Y se nos muestra una nueva *flag* con formato `music_sheet{...}`. si usamos dicha *flag* con el piano se nos dará un emblema dorado la cual es una nueva flag con el formato `gold_emblem{...}` y se nos dice que podemos poner algo en el hueco del emblema. Si ponemos la *flag* del primer emblema que obtuvimos  se nos da el nombre ***rebecca***. De la misma forma, si ponemos el emblema dorado en el huco del primer emblema obtenemos un código que tiene pinta de usar algún tipo de cifrado césar como ***ROT13*** o ***Vigènere***.

Si tratamos de decodificar el código usando ***Vigènere*** con la clave ***rebecca*** se nos desvela el siguiente mensaje:
```
there is a shield key inside the dining room. The html page is called the_great_shield_key
```
Por lo que vamos a `/diningRoom/the_great_shield_key.html` y obtenemos la *flag* con formato `shield_key{...}`.
### /diningRoom2F/

En el código fuente encontramos un código que parece cifrado con algún cifrado césar. Podemos descifrarlo aplicando la reversa del cifrado ***ROT13*** desde le terminal de la siguiente forma:
```bash
echo "Lbh trg gur oyhr trz ol chfuvat gur fgnghf gb gur ybjre sybbe. Gur trz vf ba gur qvavatEbbz svefg sybbe. Ivfvg fnccuver.ugzy" | tr 'A-Za-z' 'N-ZA-Mn-za-m'

You get the blue gem by pushing the status to the lower floor. The gem is on the diningRoom first floor. Visit sapphire.html
```

Nos indica que para tomar la gema azul debemos de ir a `/diningRoom/sapphire.html`.
### /tigerStatusRoom/

cuando accedemos a esta sala se nos indica que hay una estatua de un tigre al cual podemos poner una gema en el ojo. Si le ponemos la ***gema azul*** que hemos obtenido antes se nos muestra un mensaje con un código y unas pistas para poder descifrarlo.
```
crest 1:  
S0pXRkVVS0pKQkxIVVdTWUpFM0VTUlk9
Hint 1: Crest 1 has been encoded twice  
Hint 2: Crest 1 contanis 14 letters  
Note: You need to collect all 4 crests, combine and decode to reavel another path  
The combination should be crest 1 + crest 2 + crest 3 + crest 4. Also, the combination is a type of encoded base and you need to decode it
```

Nos dice que el código ha sido codificado dos veces. Trato de decodificarlo primero en ***base 64*** y obtengo el siguiente *output*: `JNFFORSFKVFUUSSCJREFKV2TLFFEKM2FKNJFSPI=`. Este parece estar codificado en ***base 32*** y cuando lo decodifico obtengo `RlRQIHVzZXI6IG` que concuerda con la segunda pista que dice que tiene 14 letras.

>Parece que debemos de obtener 4 códigos más, anexarlos a los demás y decodificarlos de nuevo. 
### /galleryRoom/

Entramos en la galería y se nos dice que hay una nota en la pared. El enlace nos lleva a `/note.txt` donde encontramos el segundo ***crest***: `GVFWK5KHK5WTGTCILE4DKY3DNN4GQQRTM5AVCTKE` y dos pistas nuevamente que nos dice que de nuevo está codificado dos veces y esta vez contiene 18 letras.

El código parece estar en ***base 32***, por lo que podemos decodificarlo de la siguiente manera:
```bash
echo 'GVFWK5KHK5WTGTCILE4DKY3DNN4GQQRTM5AVCTKE' | base32 -d
5KeuGWm3LHY85cckxhB3gAQMD
```
Obtenemos un nuevo código que nos han dicho que también está codificado. si probamos a decodificarlo con ***base 64*** veremos que no es correcto, y como no sabía lo que era me dirigí a ***[CyberChef](https://gchq.github.io/CyberChef/)*** donde, usando la función ***Magic*** descubrí que podía ser ***base 58*** o ***base 85***. Primero probé a decodificarlo desde ***base 58*** y me apareció un *string* que coincidía con la descripción de las 18 letras. Para asegurarme, también lo decodifiqué desde ***base 85*** y me dió datos binarios sin sentido.
```bash
echo 'GVFWK5KHK5WTGTCILE4DKY3DNN4GQQRTM5AVCTKE' | base32 -d | base58 -d
h1bnRlciwgRlRQIHBh
```
### /studyRoom/

Se nos muestra que la puerta está cerrada pero hay un emblema de un *yelmo* o *casco* incrustado en la puerta, y se nos pide introducir un código. Creo que aún no tengo la pieza que debo de poner en esta sala así que la dejo para más adelante.
### /armorRoom/

Se nos muestra una nueva puerta cerrada pero en esta ocasión nos pide el emblema del escudo que ***SÍ*** lo tenemos. Al introducirlo, se abre la puerta y pasamos a la sala de armaduras.

De nuevo encontramos una nueva `note.txt` la cual contiene el ***crest 3*** que ha sido codificado 3 veces y tiene 19 letras: 
```
MDAxMTAxMTAgMDAxMTAwMTEgMDAxMDAwMDAgMDAxMTAwMTEgMDAxMTAwMTEgMDAxMDAwMDAgMDAxMTAxMDAgMDExMDAxMDAgMDAxMDAwMDAgMDAxMTAwMTEgMDAxMTAxMTAgMDAxMDAwMDAgMDAxMTAxMDAgMDAxMTEwMDEgMDAxMDAwMDAgMDAxMTAxMDAgMDAxMTEwMDAgMDAxMDAwMDAgMDAxMTAxMTAgMDExMDAwMTEgMDAxMDAwMDAgMDAxMTAxMTEgMDAxMTAxMTAgMDAxMDAwMDAgMDAxMTAxMTAgMDAxMTAxMDAgMDAxMDAwMDAgMDAxMTAxMDEgMDAxMTAxMTAgMDAxMDAwMDAgMDAxMTAwMTEgMDAxMTEwMDEgMDAxMDAwMDAgMDAxMTAxMTAgMDExMDAwMDEgMDAxMDAwMDAgMDAxMTAxMDEgMDAxMTEwMDEgMDAxMDAwMDAgMDAxMTAxMDEgMDAxMTAxMTEgMDAxMDAwMDAgMDAxMTAwMTEgMDAxMTAxMDEgMDAxMDAwMDAgMDAxMTAwMTEgMDAxMTAwMDAgMDAxMDAwMDAgMDAxMTAxMDEgMDAxMTEwMDAgMDAxMDAwMDAgMDAxMTAwMTEgMDAxMTAwMTAgMDAxMDAwMDAgMDAxMTAxMTAgMDAxMTEwMDA=
```

La primera codificación del código parece ser ***base 64***, y cuando la decodificamos nos da un código binario legible:
```bash
echo '<código>' | base64 -d
00110110 00110011 00100000 00110011 00110011 00100000 00110100 01100100 00100000 00110011 00110110 00100000 00110100 00111001 00100000 00110100 00111000 00100000 00110110 01100011 00100000 00110111 00110110 00100000 00110110 00110100 00100000 00110101 00110110 00100000 00110011 00111001 00100000 00110110 01100001 00100000 00110101 00111001 00100000 00110101 00110111 00100000 00110011 00110101 00100000 00110011 00110000 00100000 00110101 00111000 00100000 00110011 00110010 00100000 00110110 00111000
```
Al decodificarlo nos muestra ahora un código hexadecimal, que al decodificarlo nos revela el ***crest 3***. Podemos decodificarlo usando de nuevo ***[CyberChef](https://gchq.github.io/CyberChef/)***, incluso podemos crear una *receta* que lo haga todo de forma directa (aunque recomiendo que la primera vez lo hagamos por partes para poder ser fiel a la realidad).
#### Receta de CyberChef
1. ***From Base64***
   ```
   00110110 00110011 00100000 00110011 00110011 00100000 00110100 01100100 00100000 00110011 00110110 00100000 00110100 00111001 00100000 00110100 00111000 00100000 00110110 01100011 00100000 00110111 00110110 00100000 00110110 00110100 00100000 00110101 00110110 00100000 00110011 00111001 00100000 00110110 01100001 00100000 00110101 00111001 00100000 00110101 00110111 00100000 00110011 00110101 00100000 00110011 00110000 00100000 00110101 00111000 00100000 00110011 00110010 00100000 00110110 00111000
   ```
2. ***From Binary***
   ```
   63 33 4d 36 49 48 6c 76 64 56 39 6a 59 57 35 30 58 32 68
   ```
3. ***From Hex***
   ```
   c3M6IHlvdV9jYW50X2h
   ```
#### `xxd`

También podemos decodificar el código hexadecimal usando la herramienta `xxd`.
```bash
cat código_hexadecimal | xxd -r -p
c3M6IHlvdV9jYW50X2h
```
- `-r` ***(reverse):*** Le dice a `xxd` que convierta de hexadecimal a binario/texto (en lugar de lo contrario (de binario/texto a hexadecimal)).
- `-p` ***(plain):*** Indica que el formato de entrada es "*plano*" (solo los caracteres hex, sin compensaciones de dirección ni columnas extra).
### /attic/

Se nos vuelve a mostrar una puerta en la que debemos de introducir el código del ***emblema del escudo***.

De nuevo encontramos un nuevo `note.txt` en el que obtenemos el ***crest 4***, el cual está codificado 2 veces y tienen 17 letras: `gSUERauVpvKzRpyPpuYz66JDmRTbJubaoArM6CAQsnVwte6zF9J4GGYyun3k5qM9ma4s`.

Este código parece estar codificado en ***base64***. Sin embargo, al tratar de decodificarlo desde ***base64*** veo que no es así, por lo que prueba desde ***base58*** y obtengo un código hexadecimal.
```bash
echo 'gSUERauVpvKzRpyPpuYz66JDmRTbJubaoArM6CAQsnVwte6zF9J4GGYyun3k5qM9ma4s' | base58 -d
70 5a 47 56 66 5a 6d 39 79 5a 58 5a 6c 63 67 3d 3d
```

Podemos decodificarlo con `xxd` igual que explique antes.
```bash
echo '70 5a 47 56 66 5a 6d 39 79 5a 58 5a 6c 63 67 3d 3d' | xxd -r -p
pZGVfZm9yZXZlcg==
```

***Podemos hacer todo esto en una sola línea***
```bash
echo 'gSUERauVpvKzRpyPpuYz66JDmRTbJubaoArM6CAQsnVwte6zF9J4GGYyun3k5qM9ma4s' | base58 -d | xxd -r -p
pZGVfZm9yZXZlcg==
```

>[!warning]
>***Crest 1:*** `RlRQIHVzZXI6IG`
>***Crest 2:*** `h1bnRlciwgRlRQIHBh`
>***Crest 3:*** `c3M6IHlvdV9jYW50X2h`
>***Crest 4:*** `pZGVfZm9yZXZlcg==`

>[!important]
>Ya tenemos todas las partes del ***crest final***, ahora debemos de unir todas las partes y nos queda esto:
>```
>RlRQIHVzZXI6IGh1bnRlciwgRlRQIHBhc3M6IHlvdV9jYW50X2hpZGVfZm9yZXZlcg==
>```
>Parece ser ***base64*** por lo que lo decodificamos como lo hemos ido haciendo hasta ahora, y obtenemos las credenciales para el servicio ***FTP***.
>```bash
>echo 'RlRQIHVzZXI6IGh1bnRlciwgRlRQIHBhc3M6IHlvdV9jYW50X2hpZGVfZm9yZXZlcg==' | base64 -d
>FTP user: [hidden], FTP pass: [hidden]
>```
## <font color=red>[~]</font> FTP

Cuando accedemos al servicio ***FTP*** encontramos varios ficheros que podemos descargar con el comando `mget *` y dando a ***y + ENTER***.
```
FTP
|_001-key.jpg
|_002-key.jpg
|_003-key.jpg
|_helmet_key.txt.jpg
|_important.txt
```

En esta parte tenemos una nota en la que se nos dice que debemos de conseguir abrir el archivo `helmet_key.txt.jpg`. Además, se nos revela la existencia de una habitación secreta denominada `/hidden_closet/`, la cual esta cerrada y también necesitamos el símbolo del yelmo.

Para poder abrir el archivo que usa ***GPG*** debemos de usar técnicas de ***esteganografía*** para poder acceder a las distintas partes de la contraseña que deberemos de armar y decodificar.

Lo primero es que debemos de sacar información de las imágenes y vemos que estas son imágenes de unas llaves del videojuego, más no podemos sacar de las mismas, por lo que deberemos de mirar sus metadatos para más información usando la herramienta `exiftool`.
#### 002

La imagen enumerada como ***002*** contiene un comentario con un código que parece ser ***base64***. Lo guardamos en un fichero (esta parte de la contraseña debe de ir en el medio ya que es de la imagen ***002***.
#### 003

La siguiente imagen que miro es la ***003*** ya que tiene un comentario que dice `Compressed by jpeg-recompress`. Esto nos avisa de que la imagen no es original y ha pasado por un proceso de *software*.

He usado `binwalk` y he encontrado un archivo `.zip` que contenía la tercera parte de la contraseña.

>[!Note]
>Cuando `binwalk` encuentra un archivo ***ZIP*** dentro un ***JPG***, estamos ante una técnica denominada ***File Carving***.
>- Los archivos - JPEG tienen un marcador de "Fin de Archivo" (EOF) llamado `FF D9`.
>- Muchos esteganógrafos simplemente "pegan" un archivo ZIP justo después de ese marcador.
>- El visor de imágenes ignora todo lo que hay después del `FF D9`, pero `binwalk` escanea la estructura binaria completa y lo detecta.
#### 001

Como no tenía demasiada información en esta imagen, simplemente he usado `steghide extract -sf 001-key.jpg` sin introducir ninguna contraseña y he conseguido sacar la última parte de la contraseña.

Un vez obtenida todas las partes de la  contraseña, las uno en un fichero y la decodifico desde ***base64***.

Una vez obtenida la contraseña, abro el fichero `helmet_key.gpg`:
```bash
gpg -d helmet_key.txt.gpg
```
Y nos da el código del yelmo. El cual podemos usar en la sala `/studyRoom/` y en `/hidden_closet/`.
### /studyRoom

En la puerta cerrada introducimos el código del yelmo que acabamos de conseguir y obtenemos un archivo `doom.tar.gzip`. Esta archivo esta comprimido dos veces, pero podemos descomrpimirlo directamente usando la herramienta `tar`:
```bash
tar -xvzf doom.tar.gz
```
Lo cual nos da acceso a un fichero `.txt` con el nombre de usuario para conectarnos vía ***SSH***.
### /hidden_closet/

En la puerta cerrada introducimos el código del yelmo y obtenemos dos nuevos ficheros, uno con un código cifrado con lo que parece ser un cifrado césar que no he podido descifrar y la contraseña del usuario ***SSH***. Por lo que nos conectaremos vía ***SSH*** para buscar más pistas.
## <font color=red>[~]</font> SSH
### umbrella_guest

Una vez tenemos las credenciales para acceder al sistema vía ***SSH***, obtenemos una shell como el usuario ***umbrella_guest***.

En esta parte nos toca investigar por más información, y si usamos el comando `ls -la` para ver todos los y directorios (incluidos los ocultos) del directorio `/home/umbrella_guest`, nos damos cuenta de la existencia de un directorio oculto extraño denominado `.jailcell`. Si enumeramos el contenido de dicho directorio vemos que tan solo contiene un fichero denominado `chris.txt`. Dentro de este directorio de texto encontramos la conversación que mantuvimos con ***Chris*** en el servidor web (`/hidden_closet`).

En este fichero se nos dice que ***Weasker*** es el traidor y nos da la clave para descifrar el código del ***MO disk 1*** que obtuvimos en `/hidden_closet`. Para descifrarlo volvemos a ***[CyberChef](https://gchq.github.io/CyberChef/)*** y usamos la función ***Vigenère Decode*** con la clave que se nos ha dado en `chris.txt`. Esto nos devolverá la contraseña del servicio ***SSH*** de algun usuario del sistema, imagino que será de ***weasker***. Pero como ni siquiera sé si es realmente un usuario del sistema, podemos usar la herramienta `awk`, para listar todos los usuario reales del sistema.
```bash
awk -F: '$3 >= 1000 && $7 !~ /(nologin|false)/ {print "Usuario: " $1 "\t UID: " $3 "\t Shell: " $7}' /etc/passwd
Usuario: weasker         UID: 1000	 Shell: /bin/bash
Usuario: umbrella_guest	 UID: 1001	 Shell: /bin/bash
Usuario: hunter	         UID: 1002	 Shell: /bin/bash
```
O simplemente viendo los directorios personales de los usuarios en `/home`, aunque esto no es del todo fiable.

Podemos ver que ***weasker*** es un usuario del sistema, así que seguramente la contraseña sea suya, por lo que nos conectamos vía ***SSH***.
### weasker

Dentro del directorio `/home/weasker` encontramos un fichero de texto llamado `weasker_note.txt` en el que se nos sigue contando la historia, pero no nos da más información.

Tenemos acceso a poder leer el fichero `.bash_history` en el que podemos ver que anteriormente se ha usado el comando `sudo su`. Este comando permite cambiar al usuario `root` con la contraseña del usuario actual. Por lo que si ejecutamos el comando `sudo su` y utilizamos al misma contraseña que usamos para conectarnos vía ***SSH***, conseguiremos convertirnos en el usuario ***root***.

---
---
# <font color=red>[+]</font> Explicaciones
## <font color=red>[~]</font> `/etc/sudoers`

```bash
#
# This file MUST be edited with the 'visudo' command as root.
#
# Please consider adding local content in /etc/sudoers.d/ instead of
# directly modifying this file.
#
# See the man page for details on how to write a sudoers file.
#
Defaults	env_reset
Defaults	mail_badpass
Defaults	secure_path="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin"

# Host alias specification

# User alias specification

# Cmnd alias specification

# User privilege specification
root	ALL=(ALL:ALL) ALL

# Members of the admin group may gain root privileges
%admin ALL=(ALL) ALL

# Allow members of group sudo to execute any command
%sudo	ALL=(ALL:ALL) ALL

# See sudoers(5) for more information on "#include" directives:

#includedir /etc/sudoers.d
```

Este es el archivo `/etc/sudoers` del sistema, y el culpable de que hayamos podido acceder como el usuario `root` con el comando `sudo su`. Esto es una vulnerabilidad muy presente en los sistemas de escritorio y es importante que conozcamos el porqué de que esto haya funcionado.
### `sudo su`

Este comando los utiliza mucha gente para convertirse en `root`. Sin embargo, en realidad es la combinación de dos herramientas distintas:
- `sudo` ***(Substitute User Do):*** Es una herramienta que permite a un usuario ejecutar un comando con privilegios de otro usuario (por defecto `root`). No nos convierte en `root` permanentemente, solo "nos presta" sus poderes para esa acción específica.
- `su` ***(Switch User):*** Es un comando diseñado para cambiar de identidades en la terminal. Si lo usamos solo ( `su`), nos pedirá la contraseña de `root`.
#### Qué pasa cuando lo juntamos?

Al ejecutar `sudo su`, le estamos diciendo al sistema: "*Como usuario actual, usa mis permisos de `sudo` para ejecutar el comando de cambio de identidad (`su`)*". Como `sudo` nos da autoridad de ***superusuario***, el comando `su` se ejecuta con privilegios de `root`, permitiéndonos saltar a la cuenta de administrador ***sin conocer la contraseña de root***, usando solo la nuestra (o ninguna si está configurado así).
### `/etc/sudoers`
#### El grupo `sudo` no es mágico

>[!important]
>Es un error común pensar que `/etc/sudoers` solo gestiona el grupo `sudo`. En realidad, es un motor de políticas de seguridad que mapea sujetos (*usuarios/grupos*) con objetos (*comandos*).
>

El administrador puede dar permisos a través de `/etc/sudoers` a usuarios específicos sin que pertenezcan a ningún grupo especial.
- ***Regla para un usuario individual:***
  `juan    ALL=(ALL:ALL) /usr/bin/nmap`
  (*Aquí, Juan no necesita estar en el grupo `sudo`; el archivo le da permiso a él directamente, pero solo para usar `nmap` y necesita poner su contraseña*).
- ***Regla para un grupo específico (con `%`):***
  `%ingenieros    ALL=(ALL:ALL) /bin/systemctl`
  (*Cualquiera en el grupo "ingenieros" puede reiniciar servicios*).

>[!important]
>Es importante entender que el grupo `sudo` no tiene poderes mágicos por sí mismo.
>- Si borramos la línea `%sudo    ALL=(ALL:ALL) ALL` del archivo, los usuarios de ese grupo ***perderán sus poderes*** inmediatamente, aunque sigan perteneciendo al grupo en el sistema.
>- En otras distribuciones como ***Red Hat*** o ***CentOS***, el grupo que se usa por defecto no se llama `sudo`, sino `wheel`. El archivo `/etc/sudoers` simplemente dice: `%wheel    ALL=(ALL:ALL) ALL`.
#### La vulnerabilidad de la máquina

La línea responsable es esta:
```bash
%sudo    ALL=(ALL:ALL) ALL
```
1. `%sudo`: El símbolo `%` indica que estamos hablando de un ***grupo***, no de un usuario individual. Cualquier usuario que el administrador añada al grupo `sudo` heredará estas reglas.
2. `ALL` ***(el primero):*** Especifica en qué ***hosts*** (máquinas) se aplica la regla. `ALL` significa que funciona en cualquier máquina donde esté este archivo.
3. `(ALL:ALL)`: Esto define los privilegios de ***identidad***. El primer `ALL` significa que podemos ejecutar comandos como ***cualquier usuario***, y el segundo (después de los dos puntos) significa que podemos hacerlo como ***cualquier grupo***.
4. `ALL` ***(el último):*** Define qué comandos podemos ejecutar. `ALL` significa que no tenemos restricciones: podemos usar `cat`, `rm`, `nmap`, `su`, etc.

>[!tip]
>***En resumen:*** Como nuestro usuario pertenecía al grupo `sudo` (`%sudo`), el sistema nos dio permiso para ejecutar ***CUALQUIER*** comando como ***CUAQLUIER*** usuario. Al ejecutar `sudo su`, le pedimos al sistema ejecutar el comando "*switch user*" como ***root***, y el archivo decía: "*Adelante, tienes permisos para todo*".

>[!warning]
>Esta línea rompe el principio de ***Mínimo Privilegio***, el cual dicta que un usuario debe tener los permisos estrictamente necesarios para realizar su trabajo.
#### Otras partes interesantes del archivo

- `Defaults secure_path="..."`: Esta es una medida de seguridad vital. Cuando hacemos `sudo`, el sistema ignora nuestra variable `$PATH` de usuario y usa esta. Esto evita que un atacante engañe a un administrador creando un binario falso llamado `ls` en `/tmp` y esperando a que alguien haga `sudo ls`.
- `root ALL=(ALL:ALL) ALL`: Es la regla por defecto para el ***superusuario***. Básicamente, dice que `root` tiene permiso para todo.
- `#includedir /etc/sudoers.d`: Esto es muy común en sistemas modernos. En lugar de ensuciar el archivo principal, los administradores crean archivos pequeños dentro de esa carpeta. Si un software (como `webmin`) necesita permisos especiales, suele poner su configuración ahí.

>[!tip]
>En muchos sistemas, el vector de ataque no es que tengamos permisos para ejecutar cualquier comando `(%sudo ALL=(ALL:ALL) ALL`), sino que tengamos permisos para ejecutar ***un solo comando*** con o sin contraseña. Por ejemplo:
>```bash
>%sudo ALL=(ALL) /usr/bin/find
>```
>- `%sudo`: Usuarios que pertenecen al grupo `sudo`.
>- `ALL=`: En cualquier máquina con este fichero `/etc/sudoers`.
>- `(ALL)`: Puede ejecutar el siguiente comando ***como cualquier usuario***.
>- `/usr/bin/find`: Puede ejecutar el comando `find`.
>
>***O***
>
>```bash
>%sudo ALL=(ALL) NOPASSWD: /usr/bin/find
>```
>- `%sudo`: Usuarios que pertenecen al grupo `sudo`.
>- `ALL=`: En cualquier máquina con este fichero `/etc/sudoers`.
>- `(ALL)`: Puede ejecutar el siguiente comando ***como cualquier usuario***.
>- `NOPASSWD:`: Puede ejecutar el siguiente comando sin tener que introducir la contraseña del usuario actual.
>- `/usr/bin/find`: Puede ejecutar el comando `find`.
>
>Si vemos algo así, podemos usar una técnica de ***[GTFOBins](https://gtfobins.org/)*** para escapar de ese comando y obtener una Shell de ***root***.
