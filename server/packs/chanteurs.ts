import { definePack, pair } from './types';

export default definePack({
  id: 'chanteurs',
  name: 'Chanteurs & Chanteuses',
  description: "Stars de la pop, voix mythiques et idoles d'hier et d'aujourd'hui.",
  icon: 'mic-vocal',
  pairs: [
    pair(
      'Divas du R&B',
      ['Beyoncé', 'Chanteuse américaine révélée au sein des Destiny’s Child, surnommée Queen B.'],
      ['Rihanna', 'Chanteuse originaire de la Barbade, aussi fondatrice de la marque de beauté Fenty.'],
    ),
    pair(
      'Artistes francophones à textes',
      ['Stromae', 'Artiste belge connu pour « Alors on danse » et « Papaoutai ».'],
      ['Orelsan', 'Rappeur normand à l’humour décalé, auteur de l’album « La fête est finie ».'],
    ),
    pair(
      'Stars de la pop américaine',
      ['Taylor Swift', 'Chanteuse américaine passée de la country à la pop, célèbre pour ses tournées géantes.'],
      ['Katy Perry', 'Chanteuse américaine aux clips colorés, connue pour « Roar » et « Firework ».'],
    ),
    pair(
      'Chanteurs pop à succès',
      ['Ed Sheeran', 'Chanteur britannique roux, souvent seul avec sa guitare, auteur de « Shape of You ».'],
      ['Bruno Mars', 'Chanteur américain aux influences funk et soul, interprète de « Just the Way You Are ».'],
    ),
    pair(
      'Légendes pop des années 80',
      ['Michael Jackson', 'Chanteur et danseur américain surnommé le roi de la pop, auteur de l’album « Thriller ».'],
      ['Prince', 'Musicien américain virtuose originaire de Minneapolis, célèbre pour « Purple Rain ».'],
    ),
    pair(
      'Icônes pop provocatrices',
      ['Madonna', 'Chanteuse américaine surnommée la reine de la pop, révélée dans les années 80.'],
      ['Lady Gaga', 'Chanteuse américaine aux tenues extravagantes, connue pour « Poker Face ».'],
    ),
    pair(
      'Divas à la voix puissante',
      ['Whitney Houston', 'Chanteuse américaine à la voix puissante, célèbre pour « I Will Always Love You ».'],
      ['Mariah Carey', 'Chanteuse américaine aux aigus vertigineux, associée chaque hiver à un tube de Noël.'],
    ),
    pair(
      'Grandes voix francophones',
      ['Céline Dion', 'Chanteuse québécoise, interprète de « My Heart Will Go On », la chanson de Titanic.'],
      ['Lara Fabian', 'Chanteuse belge à la voix puissante, connue pour « Je t’aime » et « Immortelle ».'],
    ),
    pair('Légendes de la variété française',
      ['Johnny Hallyday', 'Rockeur français surnommé l’idole des jeunes, célèbre pour ses concerts démesurés.'],
      ['Eddy Mitchell', 'Rockeur français, ex-leader des Chaussettes noires, passionné de cinéma américain.'],
    ),
    pair(
      'Pop francophone féminine',
      ['Angèle', 'Chanteuse belge révélée par « La Thune » et « Balance ton quoi ».'],
      ['Clara Luciani', 'Chanteuse française à frange, connue pour « La Grenade » et « Le Reste ».'],
    ),
    pair(
      'Pop urbaine française',
      ['Aya Nakamura', 'Chanteuse française d’origine malienne, connue pour « Djadja ».'],
      ['Wejdene', 'Chanteuse française révélée très jeune sur les réseaux avec « Anissa ».'],
    ),
    pair(
      'Chanteurs populaires à guitare',
      ['Vianney', 'Auteur-compositeur-interprète français aux chansons folk, connu pour « Pas là ».'],
      ['Kendji Girac', 'Chanteur français d’origine gitane, révélé par une émission de télé-crochet.'],
    ),
    pair(
      'Chanteuses françaises des années 2010',
      ['Indila', 'Chanteuse française au style mélancolique, révélée par « Dernière danse ».'],
      ['Zaz', 'Chanteuse française à la voix éraillée, connue pour « Je veux ».'],
    ),
    pair('Stars du R&B et du rap',
      ['The Weeknd', 'Chanteur canadien à la voix aiguë, connu pour « Blinding Lights ».'],
      ['Drake', 'Rappeur canadien parmi les plus écoutés en streaming, connu pour « Hotline Bling ».'],
    ),
    pair(
      'Jeunes stars de la pop',
      ['Billie Eilish', 'Chanteuse américaine au timbre chuchoté, qui compose avec son frère Finneas.'],
      ['Olivia Rodrigo', 'Chanteuse américaine révélée par une série Disney, connue pour « drivers license ».'],
    ),
    pair(
      'Stars venues de la télé jeunesse',
      ['Ariana Grande', 'Chanteuse américaine à la queue de cheval haute, connue pour « thank u, next ».'],
      ['Selena Gomez', 'Chanteuse et actrice américaine révélée par « Les Sorciers de Waverly Place ».'],
    ),
    pair(
      'Stars latinas de la pop',
      ['Shakira', 'Chanteuse colombienne célèbre pour ses déhanchés et « Waka Waka ».'],
      ['Jennifer Lopez', 'Chanteuse, danseuse et actrice américaine d’origine portoricaine, surnommée J.Lo.'],
    ),
    pair('Légendes de la musique américaine',
      ['Elvis Presley', 'Chanteur américain surnommé le King, figure majeure du rock ’n’ roll.'],
      ['Johnny Cash', 'Chanteur américain de country à la voix grave, surnommé l’homme en noir.'],
    ),
    pair(
      'Légendes du rock britannique',
      ['Freddie Mercury', 'Chanteur britannique charismatique du groupe Queen, à la voix exceptionnelle.'],
      ['David Bowie', 'Artiste britannique aux multiples personnages, dont Ziggy Stardust.'],
    ),
    pair(
      'Divas de la chanson française',
      ['Édith Piaf', 'Chanteuse française surnommée la Môme, interprète de « La Vie en rose ».'],
      ['Dalida', 'Chanteuse née en Égypte, connue pour « Paroles, paroles » et « Gigi l’amoroso ».'],
    ),
    pair(
      'Grands auteurs de la chanson',
      ['Jacques Brel', 'Auteur-compositeur belge à l’interprétation intense, auteur de « Ne me quitte pas ».'],
      ['Georges Brassens', 'Poète et chanteur français à moustache et à guitare, auteur des « Copains d’abord ».'],
    ),
    pair(
      'Chanteuses françaises des années 80',
      ['Mylène Farmer', 'Chanteuse française rousse à l’univers sombre, connue pour « Libertine ».'],
      ['Patricia Kaas', 'Chanteuse mosellane à la voix grave, connue pour « Mademoiselle chante le blues ».'],
    ),
    pair(
      'Chanteurs pop français',
      ['Christophe Maé', 'Chanteur français à chapeau, connu pour « On s’attache » et « Il est où le bonheur ».'],
      ['Calogero', 'Chanteur français d’origine sicilienne, connu pour « Si seulement je pouvais lui manquer ».'],
    ),
    pair(
      'Chanteurs issus de télé-crochets',
      ['M. Pokora', 'Chanteur et danseur alsacien, connu pour « Juste une photo de toi ».'],
      ['Amir', 'Chanteur franco-israélien qui a représenté la France à l’Eurovision avec « J’ai cherché ».'],
    ),
    pair(
      'Chanteuses pop françaises',
      ['Louane', 'Chanteuse et actrice française révélée par le film « La Famille Bélier ».'],
      ['Vitaa', 'Chanteuse française connue pour « Confessions nocturnes » et ses nombreux duos.'],
    ),
    pair(
      'Grandes voix soul britanniques',
      ['Adele', 'Chanteuse britannique à la voix puissante, connue pour « Someone Like You ».'],
      ['Amy Winehouse', 'Chanteuse britannique à la voix soul et au chignon rétro, auteure de « Rehab ».'],
    ),
    pair(
      'Stars de la pop londonienne',
      ['Dua Lipa', 'Chanteuse britannique au style disco-pop, connue pour « Levitating » et « New Rules ».'],
      ['Rita Ora', 'Chanteuse et actrice britannique, connue pour « Anywhere » et « Hot Right Now ».'],
    ),
    pair('Idoles pop révélées sur Internet',
      ['Justin Bieber', 'Chanteur canadien découvert adolescent sur YouTube, connu pour « Baby ».'],
      ['Shawn Mendes', 'Chanteur canadien révélé sur les réseaux, connu pour « Stitches » et « Señorita ».'],
    ),
    pair(
      'Anciens membres de boys bands',
      ['Harry Styles', 'Chanteur britannique ex-membre des One Direction, connu pour « As It Was ».'],
      ['Justin Timberlake', 'Chanteur et acteur américain ex-membre des NSYNC, connu pour « SexyBack ».'],
    ),
    pair(
      'Pop stars de la fin des années 90',
      ['Britney Spears', 'Chanteuse américaine surnommée la princesse de la pop, connue pour « Toxic ».'],
      ['Christina Aguilera', 'Chanteuse américaine à la voix puissante, connue pour « Genie in a Bottle ».'],
    ),
    pair(
      'Grands auteurs-compositeurs français',
      ['Francis Cabrel', 'Chanteur-guitariste du Sud-Ouest, auteur de « Je l’aime à mourir ».'],
      ['Jean-Jacques Goldman', 'Auteur-compositeur français discret, auteur de « Quand la musique est bonne ».'],
    ),
    pair(
      'Chanteurs à textes français',
      ['Renaud', 'Chanteur français au bandana et au blouson de cuir, auteur de « Mistral gagnant ».'],
      ['Alain Souchon', 'Chanteur français à la voix douce, auteur de « Foule sentimentale ».'],
    ),
    pair(
      'Légendes de la chanson française',
      ['Charles Aznavour', 'Chanteur franco-arménien, auteur de « La Bohème » et « Emmenez-moi ».'],
      ['Serge Gainsbourg', 'Auteur-compositeur provocateur à la cigarette, auteur de « La Javanaise ».'],
    ),
    pair(
      'Chanteuses pop anglophones',
      ['Sia', 'Chanteuse australienne cachant son visage sous une perruque, connue pour « Chandelier ».'],
      ['Pink', 'Chanteuse américaine au style rock, célèbre pour ses acrobaties aériennes en concert.'],
    ),
    pair(
      'Rappeuses américaines',
      ['Nicki Minaj', 'Rappeuse d’origine trinidadienne aux personnages multiples, connue pour « Super Bass ».'],
      ['Cardi B', 'Rappeuse new-yorkaise révélée par la téléréalité, connue pour « Bodak Yellow ».'],
    ),
    pair(
      'Voix de la variété française',
      ['Slimane', 'Chanteur français vainqueur de The Voice, connu pour « Viens on s’aime ».'],
      ['Claudio Capéo', 'Chanteur et accordéoniste alsacien, connu pour « Un homme debout ».'],
    ),
    pair(
      'Légendes du rap américain',
      ['Eminem', 'Rappeur de Détroit au débit rapide, connu sous l’alias Slim Shady.'],
      ['Snoop Dogg', 'Rappeur californien au flow nonchalant, figure du rap de la côte Ouest.'],
    ),
  ],
});
