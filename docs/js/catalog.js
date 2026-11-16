// Catálogo base para las recomendaciones por ánimo.
// Cada línea: artista|título|género|ánimos (f feliz, t triste, e enérgico, r relajado, n nostálgico, o romántico, m motivado, i intenso, x reflexivo)
const MOODS = { f: 'feliz', t: 'triste', e: 'energico', r: 'relajado', n: 'nostalgico', o: 'romantico', m: 'motivado', i: 'intenso', x: 'reflexivo' };
const RAW = `
Queen|Bohemian Rhapsody|Rock|inx
Radiohead|Creep|Rock alternativo|txi
Pharrell Williams|Happy|Pop / Soul|fe
The Weeknd|Blinding Lights|Pop sintético|enm
Adele|Someone Like You|Pop / Balada|ton
Soda Stereo|De música ligera|Rock en español|nef
Mercedes Sosa|Gracias a la vida|Folklore|xrn
Almendra|Muchacha (ojos de papel)|Rock nacional|orn
Billie Eilish|bad guy|Pop alternativo|ie
Eminem|Lose Yourself|Hip hop|mie
Bill Withers|Ain't No Sunshine|Soul|txr
Daft Punk|Get Lucky|Funk / Disco|feo
Nirvana|Smells Like Teen Spirit|Grunge|ie
Bob Marley & The Wailers|Three Little Birds|Reggae|rf
Fleetwood Mac|Dreams|Rock suave|rnox
Coldplay|Fix You|Pop rock|tmx
Gustavo Cerati|Crimen|Rock en español|toi
Los Fabulosos Cadillacs|Matador|Ska / Rock|ei
Rosalía|Malamente|Flamenco pop|ei
Frank Sinatra|Fly Me to the Moon|Jazz / Swing|orf
Miles Davis|So What|Jazz|rx
Kendrick Lamar|HUMBLE.|Hip hop|eim
Joy Division|Love Will Tear Us Apart|Post-punk|tni
Tame Impala|The Less I Know the Better|Psicodelia / Pop|fen
Charly García|Los dinosaurios|Rock nacional|xin
Stan Getz & João Gilberto|The Girl from Ipanema|Bossa nova|rof
Survivor|Eye of the Tiger|Hard rock|me
Queen|Don't Stop Me Now|Rock|efm
Kanye West|Stronger|Hip hop|me
Journey|Don't Stop Believin'|Rock|mnf
Kelly Clarkson|Stronger (What Doesn't Kill You)|Pop|me
Katy Perry|Roar|Pop|me
Sia|Unstoppable|Pop|m
Imagine Dragons|Believer|Pop rock|mie
Lizzo|Good as Hell|Pop / Funk|fm
Europe|The Final Countdown|Rock|emn
Foo Fighters|Best of You|Rock|mi
Macklemore & Ryan Lewis|Can't Hold Us|Hip hop|emf
Jay-Z|Empire State of Mind|Hip hop|mi
Bruce Springsteen|Born to Run|Rock|men
Linkin Park|In the End|Nu metal|itx
Linkin Park|Numb|Nu metal|ti
Metallica|Enter Sandman|Metal|ie
AC/DC|Back in Black|Hard rock|ei
AC/DC|Thunderstruck|Hard rock|eim
Guns N' Roses|Sweet Child o' Mine|Hard rock|neo
Guns N' Roses|November Rain|Rock|toi
Led Zeppelin|Stairway to Heaven|Rock|xnr
Pink Floyd|Wish You Were Here|Rock progresivo|nxt
Pink Floyd|Comfortably Numb|Rock progresivo|xtr
The Beatles|Hey Jude|Rock|nmo
The Beatles|Let It Be|Rock|rxn
The Beatles|Here Comes the Sun|Rock|frn
The Rolling Stones|Paint It Black|Rock|it
The Rolling Stones|(I Can't Get No) Satisfaction|Rock|ein
David Bowie|Space Oddity|Rock|xnr
David Bowie|Life on Mars?|Rock|xn
Elton John|Rocket Man|Pop rock|xnr
Elton John|Your Song|Pop|on
Bob Dylan|Blowin' in the Wind|Folk|xnr
Bob Dylan|Like a Rolling Stone|Folk rock|ixn
Simon & Garfunkel|The Sound of Silence|Folk|txn
Simon & Garfunkel|Bridge over Troubled Water|Folk|rtx
Leonard Cohen|Hallelujah|Folk|xtr
Johnny Cash|Hurt|Country|txi
Johnny Cash|Ring of Fire|Country|eno
Dolly Parton|Jolene|Country|ti
Louis Armstrong|What a Wonderful World|Jazz|frn
Ella Fitzgerald|Summertime|Jazz|ron
Nina Simone|Feeling Good|Jazz / Soul|mr
Billie Holiday|Strange Fruit|Jazz|txi
Dave Brubeck Quartet|Take Five|Jazz|rx
John Coltrane|My Favorite Things|Jazz|rxn
Chet Baker|My Funny Valentine|Jazz|ort
Etta James|At Last|Soul / Blues|onr
Aretha Franklin|Respect|Soul|mef
Aretha Franklin|(You Make Me Feel Like) A Natural Woman|Soul|on
Stevie Wonder|Superstition|Funk|ef
Stevie Wonder|Isn't She Lovely|Soul|fo
Marvin Gaye|What's Going On|Soul|xrt
Marvin Gaye|Let's Get It On|Soul|or
Al Green|Let's Stay Together|Soul|or
Otis Redding|(Sittin' On) The Dock of the Bay|Soul|rxn
Sam Cooke|A Change Is Gonna Come|Soul|xmt
Ben E. King|Stand by Me|Soul|onr
Earth, Wind & Fire|September|Funk / Disco|fen
Bee Gees|Stayin' Alive|Disco|efn
Donna Summer|I Feel Love|Disco|ef
ABBA|Dancing Queen|Pop / Disco|fen
ABBA|The Winner Takes It All|Pop|txn
Michael Jackson|Billie Jean|Pop|ein
Michael Jackson|Thriller|Pop|ein
Michael Jackson|Man in the Mirror|Pop|mx
Prince|Purple Rain|Rock / Pop|toni
Prince|Kiss|Funk|ef
Madonna|Like a Prayer|Pop|ein
Madonna|Vogue|Pop / Dance|ef
Whitney Houston|I Wanna Dance with Somebody|Pop|fen
Whitney Houston|I Will Always Love You|Pop / Balada|otn
Céline Dion|My Heart Will Go On|Pop / Balada|otn
Mariah Carey|All I Want for Christmas Is You|Pop|fo
Cyndi Lauper|Girls Just Want to Have Fun|Pop|fen
a-ha|Take On Me|Pop sintético|fen
Depeche Mode|Enjoy the Silence|Synth pop|rxo
The Cure|Pictures of You|Post-punk|tnx
The Cure|Just Like Heaven|Post-punk|onf
The Smiths|There Is a Light That Never Goes Out|Indie|ton
The Smiths|How Soon Is Now?|Indie|tix
Oasis|Wonderwall|Britpop|nor
Oasis|Don't Look Back in Anger|Britpop|nmx
Blur|Song 2|Britpop|eif
Radiohead|Karma Police|Rock alternativo|xit
Radiohead|No Surprises|Rock alternativo|trx
Coldplay|Yellow|Pop rock|onr
Coldplay|The Scientist|Pop rock|tox
Coldplay|Viva la Vida|Pop rock|mxn
U2|With or Without You|Rock|toi
U2|One|Rock|xto
U2|Beautiful Day|Rock|fm
The Killers|Mr. Brightside|Indie rock|ein
Arctic Monkeys|Do I Wanna Know?|Indie rock|io
Arctic Monkeys|R U Mine?|Indie rock|ei
The Strokes|Last Nite|Indie rock|enf
Foster the People|Pumped Up Kicks|Indie pop|fix
MGMT|Kids|Indie / Electrónica|efn
Mac DeMarco|Chamber of Reflection|Indie|rx
Beach House|Space Song|Dream pop|rox
Cigarettes After Sex|Apocalypse|Dream pop|ort
Lana Del Rey|Summertime Sadness|Pop alternativo|ton
Lana Del Rey|Video Games|Pop alternativo|ton
Lorde|Royals|Pop alternativo|xi
Lorde|Green Light|Pop|etm
Billie Eilish|everything i wanted|Pop alternativo|tx
Billie Eilish|Ocean Eyes|Pop|ort
Taylor Swift|Shake It Off|Pop|fe
Taylor Swift|All Too Well|Pop|tnx
Taylor Swift|Love Story|Pop / Country|onf
Ed Sheeran|Shape of You|Pop|foe
Ed Sheeran|Perfect|Pop|or
Ed Sheeran|Thinking Out Loud|Pop|or
Sam Smith|Stay with Me|Pop / Soul|to
Adele|Rolling in the Deep|Pop / Soul|iet
Adele|Hello|Pop / Balada|tnx
Amy Winehouse|Back to Black|Soul|tin
Amy Winehouse|Rehab|Soul|eif
Bruno Mars|Uptown Funk|Funk / Pop|ef
Bruno Mars|Just the Way You Are|Pop|of
John Legend|All of Me|Pop / Soul|or
Ariana Grande|7 rings|Pop / Trap|fe
Dua Lipa|Don't Start Now|Pop / Disco|efm
Dua Lipa|Levitating|Pop / Disco|ef
Harry Styles|As It Was|Pop|ntx
Harry Styles|Watermelon Sugar|Pop|fro
Olivia Rodrigo|drivers license|Pop|tx
Post Malone|Circles|Pop / Hip hop|txr
Glass Animals|Heat Waves|Indie pop|ntr
Måneskin|Beggin'|Rock|eif
Tame Impala|Let It Happen|Psicodelia / Pop|ex
Daft Punk|Around the World|Electrónica|ef
Daft Punk|One More Time|Electrónica|fem
Calvin Harris|Summer|Electrónica|fe
Avicii|Wake Me Up|Electrónica / Folk|mfx
Avicii|Levels|Electrónica|efm
Swedish House Mafia|Don't You Worry Child|Electrónica|nme
Kygo|Firestone|Electrónica|rf
Disclosure|Latch|Electrónica|oe
Justice|D.A.N.C.E.|Electrónica|ef
Eminem|Stan|Hip hop|itx
Eminem|Mockingbird|Hip hop|txo
Eminem|Without Me|Hip hop|ef
2Pac|Dear Mama|Hip hop|nxo
2Pac|California Love|Hip hop|ef
The Notorious B.I.G.|Juicy|Hip hop|mnf
Nas|N.Y. State of Mind|Hip hop|ix
Dr. Dre|Still D.R.E.|Hip hop|eni
Outkast|Hey Ya!|Hip hop / Funk|fe
Outkast|Ms. Jackson|Hip hop|xtn
Lauryn Hill|Doo Wop (That Thing)|Hip hop / Soul|mxf
Kendrick Lamar|Alright|Hip hop|mxi
Kendrick Lamar|Swimming Pools (Drank)|Hip hop|xi
Drake|Hotline Bling|Hip hop|or
Travis Scott|SICKO MODE|Hip hop / Trap|ei
Childish Gambino|This Is America|Hip hop|ix
Cardi B|Bodak Yellow|Hip hop|emi
Shakira|Hips Don't Lie|Pop latino|ef
Shakira|Waka Waka (This Time for Africa)|Pop latino|fem
Luis Fonsi & Daddy Yankee|Despacito|Reguetón|feo
Daddy Yankee|Gasolina|Reguetón|efn
Bad Bunny|Tití Me Preguntó|Reguetón|ef
Bad Bunny|Me Porto Bonito|Reguetón|ef
Bad Bunny|Dákiti|Reguetón|ero
J Balvin|Mi Gente|Reguetón|ef
Karol G|Tusa|Reguetón|tei
Rosalía|DESPECHÁ|Pop latino|ef
Maluma|Felices los 4|Pop latino|fo
Juanes|La camisa negra|Pop latino|eft
Juanes|A Dios le pido|Pop rock|mf
Maná|Rayando el sol|Rock en español|otn
Maná|Clavado en un bar|Rock en español|tnx
Enrique Iglesias|Bailando|Pop latino|feo
Ricky Martin|Livin' la Vida Loca|Pop latino|ef
Celia Cruz|La vida es un carnaval|Salsa|fme
Héctor Lavoe|El cantante|Salsa|xni
Rubén Blades|Pedro Navaja|Salsa|xin
Buena Vista Social Club|Chan Chan|Son cubano|rn
Carlos Gardel|Por una cabeza|Tango|on
Carlos Gardel|Volver|Tango|ntx
Astor Piazzolla|Libertango|Tango|iex
Astor Piazzolla|Adiós Nonino|Tango|tnx
Mercedes Sosa|Alfonsina y el mar|Folklore|tx
Atahualpa Yupanqui|Los ejes de mi carreta|Folklore|nrx
Violeta Parra|Volver a los 17|Folklore|nox
Víctor Jara|Te recuerdo Amanda|Folklore|ton
Soda Stereo|Persiana Americana|Rock nacional|ein
Soda Stereo|En la ciudad de la furia|Rock nacional|ien
Soda Stereo|Zoom|Rock nacional|xri
Soda Stereo|Cuando pase el temblor|Rock nacional|nfr
Gustavo Cerati|Puente|Rock nacional|xrn
Gustavo Cerati|Adiós|Rock nacional|tx
Charly García|Demoliendo hoteles|Rock nacional|ixn
Charly García|Nos siguen pegando abajo|Rock nacional|iex
Charly García & Luis Alberto Spinetta|Rezo por vos|Rock nacional|trn
Pescado Rabioso|Seguir viviendo sin tu amor|Rock nacional|tox
Luis Alberto Spinetta|Barro tal vez|Rock nacional|rxt
Fito Páez|Mariposa Tecknicolor|Rock nacional|fnm
Fito Páez|11 y 6|Rock nacional|efi
Patricio Rey y sus Redonditos de Ricota|Ji Ji Ji|Rock nacional|eif
Patricio Rey y sus Redonditos de Ricota|Un ángel para tu soledad|Rock nacional|ton
Divididos|Spaghetti del rock|Rock nacional|efi
Los Piojos|Ay ay ay|Rock nacional|efn
Los Piojos|Verano del 92|Rock nacional|fne
La Renga|El revelde|Rock nacional|ime
La Renga|Balada del diablo y la muerte|Rock nacional|ixe
Los Auténticos Decadentes|Los piratas|Ska / Rock|fe
Los Fabulosos Cadillacs|Mal bicho|Ska / Rock|ei
Los Fabulosos Cadillacs|Vasos vacíos|Ska / Rock|tnx
Andrés Calamaro|Flaca|Rock nacional|ont
Andrés Calamaro|Paloma|Rock nacional|tox
Los Abuelos de la Nada|Mil horas|Rock nacional|ont
Los Abuelos de la Nada|Himno de mi corazón|Rock nacional|nmf
Sui Generis|Rasguña las piedras|Rock nacional|txn
Sui Generis|Confesiones de invierno|Rock nacional|nxt
Serú Girán|Seminare|Rock nacional|xin
Luis Miguel|La incondicional|Pop / Balada|on
Luis Miguel|Hasta que me olvides|Pop / Balada|to
José José|El triste|Balada|tno
Juan Gabriel|Querida|Balada|ont
Julieta Venegas|Me voy|Pop latino|mtf
Natalia Lafourcade|Hasta la raíz|Pop latino|orn
Café Tacvba|Eres|Rock en español|orx
Caifanes|Afuera|Rock en español|ixt
Héroes del Silencio|Entre dos tierras|Rock en español|ixe
Enanitos Verdes|Lamento boliviano|Rock en español|tnx
Los Prisioneros|El baile de los que sobran|Rock en español|xim
Los Prisioneros|Muévete|Rock en español|ef
Jorge Drexler|Al otro lado del río|Pop latino|rxm
Jorge Drexler|Todo se transforma|Pop latino|xrm
Joaquín Sabina|Contigo|Pop rock|on
Joan Manuel Serrat|Mediterráneo|Cantautor|nxr
Joan Manuel Serrat|Penélope|Cantautor|tnx
La Oreja de Van Gogh|Rosas|Pop rock|onf
Amaral|Sin ti no soy nada|Pop rock|oti
Estopa|Vacaciones|Rumba / Pop|fr
Manu Chao|Me gustas tú|Mestizaje|fro
Gipsy Kings|Bamboléo|Rumba|fe
Los Ángeles Azules|Cómo te voy a olvidar|Cumbia|not
Gilda|No me arrepiento de este amor|Cumbia|tmi
Claude Debussy|Clair de Lune|Clásica|rxo
Erik Satie|Gymnopédie No. 1|Clásica|rx
Johann Pachelbel|Canon in D|Clásica|ron
Ludwig van Beethoven|Für Elise|Clásica|rno
Wolfgang Amadeus Mozart|Eine kleine Nachtmusik|Clásica|fer
Ludovico Einaudi|Experience|Neoclásica|xmr
Ludovico Einaudi|Nuvole Bianche|Neoclásica|rxn
Hans Zimmer|Time|Banda sonora|xmr
Ennio Morricone|Gabriel's Oboe|Banda sonora|rnx
Max Richter|On the Nature of Daylight|Neoclásica|trx
Brian Eno|An Ending (Ascent)|Ambient|rx
Bonobo|Kerala|Electrónica|rx
Khruangbin|Maria También|Psicodelia / Funk|rf
Jack Johnson|Banana Pancakes|Folk / Pop|rfo
Jack Johnson|Better Together|Folk / Pop|orf
Norah Jones|Don't Know Why|Jazz / Pop|rto
Norah Jones|Come Away with Me|Jazz / Pop|or
Bon Iver|Skinny Love|Indie folk|txo
Bon Iver|Holocene|Indie folk|rxn
Fleet Foxes|White Winter Hymnal|Indie folk|rx
Iron & Wine|Such Great Heights|Indie folk|or
The Lumineers|Ho Hey|Folk|fo
Mumford & Sons|Little Lion Man|Folk rock|iem
Of Monsters and Men|Little Talks|Indie folk|fe
Vance Joy|Riptide|Indie folk|for
Passenger|Let Her Go|Folk|tnx
James Blunt|You're Beautiful|Pop|otr
Lewis Capaldi|Someone You Loved|Pop|tx
Sia|Chandelier|Pop|tie
Gotye|Somebody That I Used to Know|Indie pop|tx
Bob Marley & The Wailers|No Woman, No Cry|Reggae|ntr
Bob Marley & The Wailers|One Love|Reggae|fro
Bob Marley & The Wailers|Redemption Song|Reggae|xmr
Bob Marley & The Wailers|Is This Love|Reggae|or
Sublime|What I Got|Ska punk|fr
Green Day|Basket Case|Punk|eix
Green Day|Boulevard of Broken Dreams|Punk / Rock|tx
Green Day|Good Riddance (Time of Your Life)|Punk / Acústico|nxr
Blink-182|All the Small Things|Pop punk|fe
Ramones|Blitzkrieg Bop|Punk|efi
The Clash|London Calling|Punk|imx
The Clash|Should I Stay or Should I Go|Punk|ei
Sex Pistols|Anarchy in the U.K.|Punk|ie
My Chemical Romance|Welcome to the Black Parade|Rock alternativo|imn
Paramore|Misery Business|Pop punk|ie
Fall Out Boy|Centuries|Pop rock|mei
Twenty One Pilots|Stressed Out|Pop alternativo|xnt
Evanescence|Bring Me to Life|Rock gótico|ite
Muse|Supermassive Black Hole|Rock alternativo|ieo
Muse|Starlight|Rock alternativo|moe
Pearl Jam|Alive|Grunge|imx
Pearl Jam|Black|Grunge|txi
Soundgarden|Black Hole Sun|Grunge|ix
Alice in Chains|Rooster|Grunge|ix
Red Hot Chili Peppers|Californication|Rock alternativo|xrn
Red Hot Chili Peppers|Under the Bridge|Rock alternativo|tnx
Red Hot Chili Peppers|Can't Stop|Funk rock|emf
Rage Against the Machine|Killing in the Name|Rap metal|ie
System of a Down|Chop Suey!|Metal alternativo|ie
Iron Maiden|The Trooper|Metal|eim
Black Sabbath|Paranoid|Metal|ie
Deep Purple|Smoke on the Water|Hard rock|en
Dire Straits|Sultans of Swing|Rock|rnf
Eric Clapton|Tears in Heaven|Rock / Balada|txn
Eric Clapton|Wonderful Tonight|Rock / Balada|or
Eagles|Hotel California|Rock|nxr
Creedence Clearwater Revival|Have You Ever Seen the Rain?|Rock|ntx
The Doors|Light My Fire|Rock psicodélico|ein
The Doors|Riders on the Storm|Rock psicodélico|rxi
Jimi Hendrix|Purple Haze|Rock psicodélico|ien
Jimi Hendrix|All Along the Watchtower|Rock|ixn
Janis Joplin|Piece of My Heart|Blues rock|itn
The Who|Baba O'Riley|Rock|emn
The Kinks|Lola|Rock|fen
Van Morrison|Brown Eyed Girl|Rock / Soul|fno
Van Morrison|Moondance|Jazz / Rock|rof
Fleetwood Mac|Go Your Own Way|Rock|ite
Fleetwood Mac|The Chain|Rock|ixt
Stevie Nicks|Edge of Seventeen|Rock|inx
Phil Collins|In the Air Tonight|Rock / Pop|ixt
Peter Gabriel|Sledgehammer|Pop rock|efn
Tears for Fears|Everybody Wants to Rule the World|Pop sintético|nxr
Tears for Fears|Mad World|Pop sintético|tx
The Police|Every Breath You Take|Rock|oin
The Police|Roxanne|Rock|io
Billy Joel|Piano Man|Pop rock|nxr
Billy Joel|Uptown Girl|Pop rock|foe
Bon Jovi|Livin' on a Prayer|Rock|men
Bon Jovi|It's My Life|Rock|me
Toto|Africa|Rock|nor
Lionel Richie|Hello|Balada|on
Roxette|It Must Have Been Love|Pop|ton
Eurythmics|Sweet Dreams (Are Made of This)|Pop sintético|xin
Kate Bush|Running Up That Hill|Pop sintético|ixm
Hozier|Take Me to Church|Indie / Soul|iox
Rihanna|Umbrella|Pop|orf
Rihanna|Diamonds|Pop|omf
Beyoncé|Halo|Pop / Balada|om
Beyoncé|Crazy in Love|R&B|efo
Beyoncé|Formation|R&B / Hip hop|mi
Alicia Keys|Fallin'|R&B|ot
Usher|Yeah!|R&B|ef
Frank Ocean|Pyramids|R&B|xor
Frank Ocean|Thinking Bout You|R&B|otr
SZA|Kill Bill|R&B|ito
The Weeknd|Save Your Tears|Pop sintético|tno
The Weeknd|Starboy|Pop / R&B|ei
Justin Timberlake|Can't Stop the Feeling!|Pop|fem
Miley Cyrus|Flowers|Pop|mfx
`;
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const CATALOG = {
  moods: Object.values(MOODS),
  tracks: RAW.trim().split('\n').map((l) => { const [artist, title, genre, m] = l.split('|'); return { id: slug(artist + ' ' + title), title, artist, genre, moods: [...m].map((c) => MOODS[c]) }; }),
};
