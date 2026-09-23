import { definePack, p, universe, w } from './types';

export default definePack({
  id: 'chanteurs',
  name: 'Chanteurs & Chanteuses',
  description: "Stars de la pop, voix mythiques et idoles d'hier et d'aujourd'hui.",
  icon: 'mic-vocal',
  universes: [
    universe({
      id: 'general',
      name: 'Chanteurs & Chanteuses',
      precise: false,
      words: {
        // Voix et divas
        beyonce: w('Beyoncé', 'Chanteuse américaine révélée au sein des Destiny’s Child, surnommée Queen B.'),
        rihanna: w('Rihanna', 'Chanteuse née à la Barbade, connue pour « Umbrella » et fondatrice de la marque Fenty.'),
        whitney: w('Whitney Houston', 'Chanteuse américaine à la voix puissante, célèbre pour « I Will Always Love You ».'),
        mariah: w('Mariah Carey', 'Chanteuse américaine aux aigus vertigineux, dont un tube de Noël revient chaque hiver.'),
        celine: w('Céline Dion', 'Chanteuse québécoise, interprète de « My Heart Will Go On », la chanson de Titanic.'),
        adele: w('Adele', 'Chanteuse britannique à la voix puissante, connue pour « Someone Like You » et « Hello ».'),
        amy: w('Amy Winehouse', 'Chanteuse britannique à la voix soul et au chignon rétro, interprète de « Rehab ».'),

        // Pop internationale
        taylor: w('Taylor Swift', 'Chanteuse américaine passée de la country à la pop, célèbre pour ses tournées géantes.'),
        katy: w('Katy Perry', 'Chanteuse américaine aux clips colorés, connue pour « Roar » et « Firework ».'),
        ariana: w('Ariana Grande', 'Chanteuse américaine à la queue de cheval haute, connue pour « 7 rings ».'),
        dua: w('Dua Lipa', 'Chanteuse britannique au style disco-pop, connue pour « Levitating » et « New Rules ».'),
        gaga: w('Lady Gaga', 'Chanteuse américaine aux tenues extravagantes, connue pour « Poker Face ».'),
        madonna: w('Madonna', 'Chanteuse américaine surnommée la reine de la pop, révélée dans les années 1980.'),
        britney: w('Britney Spears', 'Chanteuse américaine surnommée la princesse de la pop, connue pour « Toxic ».'),
        billie: w('Billie Eilish', 'Chanteuse américaine au timbre chuchoté, qui compose avec son frère Finneas.'),
        olivia: w('Olivia Rodrigo', 'Chanteuse américaine révélée par une série Disney, connue pour « drivers license ».'),
        shakira: w('Shakira', 'Chanteuse colombienne célèbre pour ses déhanchés et le tube « Waka Waka ».'),
        jlo: w('Jennifer Lopez', 'Chanteuse, danseuse et actrice américaine d’origine portoricaine, surnommée J.Lo.'),

        // Chanteurs internationaux
        'michael-jackson': w('Michael Jackson', 'Chanteur et danseur américain surnommé le roi de la pop, auteur de l’album « Thriller ».'),
        prince: w('Prince', 'Musicien américain virtuose originaire de Minneapolis, célèbre pour « Purple Rain ».'),
        elvis: w('Elvis Presley', 'Chanteur américain surnommé le King, figure majeure du rock ’n’ roll.'),
        freddie: w('Freddie Mercury', 'Chanteur charismatique du groupe Queen, à la voix d’une puissance exceptionnelle.'),
        bowie: w('David Bowie', 'Artiste britannique aux multiples personnages, dont le célèbre Ziggy Stardust.'),
        'ed-sheeran': w('Ed Sheeran', 'Chanteur britannique roux, souvent seul avec sa guitare, auteur de « Shape of You ».'),
        'bruno-mars': w('Bruno Mars', 'Chanteur américain aux influences funk et soul, interprète de « Just the Way You Are ».'),
        weeknd: w('The Weeknd', 'Chanteur canadien à la voix aiguë, connu pour « Blinding Lights ».'),
        bieber: w('Justin Bieber', 'Chanteur canadien découvert adolescent sur YouTube, connu pour « Baby ».'),
        harry: w('Harry Styles', 'Chanteur britannique révélé au sein des One Direction, connu pour « As It Was ».'),

        // Scène francophone actuelle
        stromae: w('Stromae', 'Artiste belge connu pour « Alors on danse », « Papaoutai » et « Formidable ».'),
        angele: w('Angèle', 'Chanteuse belge révélée par « La Thune » et « Balance ton quoi ».'),
        clara: w('Clara Luciani', 'Chanteuse française à frange, connue pour « La Grenade » et « Le Reste ».'),
        aya: w('Aya Nakamura', 'Chanteuse née au Mali et élevée en France, connue pour « Djadja » et « Pookie ».'),
        indila: w('Indila', 'Chanteuse française au style mélancolique, révélée par « Dernière danse ».'),
        zaz: w('Zaz', 'Chanteuse française à la voix éraillée, connue pour « Je veux ».'),
        louane: w('Louane', 'Chanteuse et actrice révélée par The Voice puis par le film « La Famille Bélier ».'),
        vitaa: w('Vitaa', 'Chanteuse française connue pour « Confessions nocturnes » et ses nombreux duos.'),
        vianney: w('Vianney', 'Auteur-compositeur-interprète français aux chansons folk, connu pour « Pas là ».'),
        kendji: w('Kendji Girac', 'Chanteur français d’origine gitane, guitare à la main, connu pour « Andalouse ».'),
        slimane: w('Slimane', 'Chanteur français vainqueur de The Voice, connu pour « Viens on s’aime ».'),
        mae: w('Christophe Maé', 'Chanteur français à chapeau, connu pour « On s’attache » et « Il est où le bonheur ».'),
        calogero: w('Calogero', 'Chanteur français d’origine sicilienne, connu pour « Si seulement je pouvais lui manquer ».'),
        pokora: w('M. Pokora', 'Chanteur et danseur alsacien, connu pour « Juste une photo de toi ».'),
        amir: w('Amir', 'Chanteur qui a représenté la France à l’Eurovision 2016 avec « J’ai cherché ».'),

        // Chanson française
        johnny: w('Johnny Hallyday', 'Rockeur français surnommé l’idole des jeunes, célèbre pour ses concerts démesurés.'),
        sardou: w('Michel Sardou', 'Chanteur français à la voix puissante, connu pour « Les Lacs du Connemara ».'),
        piaf: w('Édith Piaf', 'Chanteuse française surnommée la Môme, interprète de « La Vie en rose ».'),
        dalida: w('Dalida', 'Chanteuse née en Égypte, connue pour « Paroles, paroles » et « Gigi l’amoroso ».'),
        mylene: w('Mylène Farmer', 'Chanteuse rousse à l’univers sombre et provocant, connue pour « Libertine ».'),
        aznavour: w('Charles Aznavour', 'Chanteur franco-arménien, auteur de « La Bohème » et « Emmenez-moi ».'),
        brel: w('Jacques Brel', 'Chanteur belge à l’interprétation intense, auteur de « Ne me quitte pas ».'),
        gainsbourg: w('Serge Gainsbourg', 'Chanteur provocateur à la cigarette, auteur de « La Javanaise ».'),
        renaud: w('Renaud', 'Chanteur français au bandana et au blouson de cuir, auteur de « Mistral gagnant ».'),
        souchon: w('Alain Souchon', 'Chanteur français à la voix douce, auteur de « Foule sentimentale ».'),
        cabrel: w('Francis Cabrel', 'Chanteur-guitariste du Sud-Ouest, auteur de « Je l’aime à mourir ».'),
        goldman: w('Jean-Jacques Goldman', 'Auteur-compositeur discret, auteur de « Quand la musique est bonne ».'),
      },
      pairs: [
        // Voix et divas
        p('beyonce', 'rihanna', 'Stars du R&B et de la pop'),
        p('beyonce', 'whitney', 'Grandes voix américaines'),
        p('whitney', 'mariah', 'Divas de la chanson'),
        p('mariah', 'celine', 'Divas de la chanson'),
        p('celine', 'adele', 'Grandes voix de la pop'),
        p('adele', 'amy', 'Chanteuses britanniques'),

        // Pop internationale
        p('taylor', 'katy', 'Stars de la pop américaine'),
        p('taylor', 'ariana', 'Stars de la pop américaine'),
        p('ariana', 'dua', 'Stars de la pop'),
        p('katy', 'gaga', 'Stars de la pop américaine'),
        p('gaga', 'madonna', 'Icônes de la pop'),
        p('madonna', 'britney', 'Icônes de la pop'),
        p('madonna', 'mylene', 'Icônes de la pop'),
        p('billie', 'olivia', 'Jeunes stars de la pop'),
        p('shakira', 'jlo', 'Stars de la pop'),

        // Chanteurs internationaux
        p('michael-jackson', 'prince', 'Légendes de la musique'),
        p('michael-jackson', 'elvis', 'Légendes de la musique'),
        p('freddie', 'bowie', 'Légendes du rock'),
        p('ed-sheeran', 'bruno-mars', 'Chanteurs pop à succès'),
        p('bruno-mars', 'weeknd', 'Chanteurs pop à succès'),
        p('weeknd', 'bieber', 'Stars de la pop'),
        p('bieber', 'harry', 'Idoles de la pop'),

        // Scène francophone actuelle
        p('stromae', 'angele', 'Artistes francophones'),
        p('angele', 'clara', 'Pop francophone'),
        p('angele', 'aya', 'Pop francophone'),
        p('indila', 'zaz', 'Chanteuses françaises'),
        p('indila', 'louane', 'Chanteuses françaises'),
        p('louane', 'vitaa', 'Chanteuses françaises'),
        p('vianney', 'kendji', 'Variété française'),
        p('kendji', 'slimane', 'Variété française'),
        p('vianney', 'mae', 'Variété française'),
        p('mae', 'calogero', 'Variété française'),
        p('pokora', 'amir', 'Variété française'),

        // Chanson française
        p('johnny', 'sardou', 'Monuments de la chanson'),
        p('johnny', 'elvis', 'Idoles de la musique'),
        p('piaf', 'dalida', 'Légendes de la chanson'),
        p('dalida', 'mylene', 'Divas de la chanson'),
        p('aznavour', 'brel', 'Légendes de la chanson'),
        p('gainsbourg', 'renaud', 'Chanson française'),
        p('renaud', 'souchon', 'Chanson française'),
        p('souchon', 'cabrel', 'Chanson française'),
        p('cabrel', 'goldman', 'Chanson française'),
      ],
    }),
  ],
});
