Voglio costruire un'applicazione che permetta di gestire le piante domestiche (o in generale, un qualunque spazio verde).

Dressly è un altro progetto, creato sempre da te, che si trova in /home/fsorge/projects/dressly/

Stack tecnologico:
- Angular 22 con Angular CDK e LucideIcons https://angular.dev/installation
- NestJS https://docs.nestjs.com/first-steps
- Autenticazione OIDC come su progetto Dressly (refresh sessione, persistenza sessione, modale di sessione scaduta)
- Docker come su progetto Dressly
- Pipeline GitHub come su progetto Dressly
- Database SQlite come su Dressly
- Licenza AGPL come su Dressly
- npm unificato alla root per lanciare frontend e backend
- PWA e sincronizzazione offline identica a Dressly

L'applicazione dovrà:
- Gestire gli utenti
- Ogni utente potrà creare N spazi
- Ogni spazio (nome, location con link frontend che rimanda al provider di mappe, descrizione, foto di copertina) potrà avere N stanze
- Ogni stanza (nome, descrizione, foto di copertina) potrà avere N piante
- Le piante vanno create in modo generico slegate da ogni stanza, e poi dentro alle stanze si faranno i vari abbinamenti
- Le piante, quando vengono inserite in una stanza, acquisiscono informazioni specifiche su quella stanza (ultima volta che è stata innaffiata; posizione)
- L'abbinamento piante <-> stanza si potrà fare sia da dentro una stanza, che dalla scheda di una pianta, mediante un pulsante "Aggiungi a stanza" che apre una modale CDK Angular con prima la scelta dello spazio e poi della stanza

Le piante:
- Avranno N foto
- Avere un nome comune
- Avere un nome biologo
- Una scheda composta da
 - Posizionamento sole (luce diretta, indiretta, filtrata) in base alla stagione
 - Posizionamento interno/esterno in base alla stagione
 - Innaffiamento (frequenza, quantità, solo a terriccio asciutto, ecc) in base alla stagione
 - Travasamento e tipologia di terriccio e composizione
 - Concimazione con vari dati


Le impostazioni utente dovranno gestire:
- provider mappe preferito per i link (Google Maps, Apple Maps, Bing Maps, OpenStreetMaps (default))


Altri dettagli:
- Spazi e stanze vanno sempre rappresentati, a frontend, come card con foto di copertina, titolo, posizione e descrizione
- Utilizza quanti components Angular riutilizzabili possibile, evitando di sdoppiare il codice
