import { definePack, p, universe, w } from './types';

export default definePack({
  id: 'football',
  name: 'Football',
  description: 'Légendes, clubs rivaux, stades mythiques et gestes techniques.',
  icon: 'volleyball',
  universes: [
    universe({
      id: 'general',
      name: 'Football',
      precise: false,
      words: {
        // Joueurs et entraîneurs
        messi: w('Messi', 'Génie argentin formé au FC Barcelone, champion du monde avec son pays en 2022.'),
        'cristiano-ronaldo': w('Cristiano Ronaldo', 'Attaquant portugais surnommé CR7, passé par Manchester United, le Real Madrid et la Juventus.'),
        maradona: w('Maradona', 'Meneur argentin champion du monde en 1986, auteur de la célèbre « main de Dieu ».'),
        ronaldinho: w('Ronaldinho', 'Meneur brésilien au sourire célèbre, Ballon d’Or 2005, magicien du dribble au Barça.'),
        neymar: w('Neymar', 'Attaquant brésilien virtuose, passé par Santos, le FC Barcelone et le PSG.'),
        zidane: w('Zidane', 'Meneur français champion du monde en 1998, puis entraîneur à succès du Real Madrid.'),
        platini: w('Platini', 'Meneur français des années 1980, triple Ballon d’Or, star de la Juventus.'),
        henry: w('Thierry Henry', 'Attaquant français rapide et élégant, légende d’Arsenal, champion du monde en 1998.'),
        giroud: w('Giroud', 'Avant-centre français au jeu de tête redoutable, champion du monde en 2018.'),
        benzema: w('Benzema', 'Attaquant français formé à Lyon, longtemps au Real Madrid, Ballon d’Or 2022.'),
        mbappe: w('Mbappé', 'Attaquant français ultra-rapide né en 1998, révélé à Monaco, champion du monde en 2018.'),
        kante: w('Kanté', 'Milieu récupérateur français infatigable, champion du monde 2018, passé par Leicester et Chelsea.'),
        pogba: w('Pogba', 'Milieu français technique au grand gabarit, buteur en finale de la Coupe du monde 2018.'),
        lloris: w('Lloris', 'Gardien français, capitaine des Bleus champions du monde en 2018, longtemps à Tottenham.'),
        barthez: w('Barthez', 'Gardien français au crâne rasé, champion du monde en 1998 et d’Europe en 2000.'),
        deschamps: w('Deschamps', 'Capitaine des Bleus champions du monde en 1998, devenu leur sélectionneur en 2012.'),
        'laurent-blanc': w('Laurent Blanc', 'Défenseur central surnommé le Président, champion du monde 1998, puis entraîneur du PSG.'),

        // Clubs français
        psg: w('PSG', 'Club de la capitale fondé en 1970, qui joue au Parc des Princes.'),
        monaco: w('Monaco', 'Club de la Principauté au maillot rouge et blanc, qui joue au stade Louis-II.'),
        lyon: w('Lyon', 'Club rhodanien, sacré champion de France sept fois de suite dans les années 2000.'),
        marseille: w('Marseille', 'Club phocéen vainqueur de la Ligue des champions en 1993, qui joue au Vélodrome.'),
        lens: w('Lens', 'Club artésien aux couleurs sang et or, porté par le public fervent de Bollaert.'),
        'saint-etienne': w('Saint-Étienne', 'Club du Forez surnommé les Verts, grande équipe française des années 1970.'),

        // Clubs européens
        'real-madrid': w('Real Madrid', 'Club de la capitale espagnole, recordman des victoires en Ligue des champions.'),
        bayern: w('Bayern Munich', 'Club bavarois, le plus titré d’Allemagne, qui joue à l’Allianz Arena.'),
        'ac-milan': w('AC Milan', 'Club lombard au maillot rayé rouge et noir, surnommé les Rossoneri.'),
        juventus: w('Juventus', 'Club turinois au maillot rayé noir et blanc, surnommé la Vieille Dame.'),
        barcelone: w('FC Barcelone', 'Club catalan au maillot bleu et grenat, dont la devise est « Més que un club ».'),
        'man-city': w('Manchester City', 'Club anglais au maillot bleu ciel surnommé les Citizens, qui joue à l’Etihad Stadium.'),
        liverpool: w('Liverpool', 'Club anglais au maillot rouge, qui joue à Anfield au son de « You’ll Never Walk Alone ».'),
        dortmund: w('Borussia Dortmund', 'Club de la Ruhr au maillot jaune et noir, célèbre pour son Mur jaune de supporters.'),
        'man-united': w('Manchester United', 'Club anglais surnommé les Red Devils, qui joue à Old Trafford.'),

        // Compétitions
        'ligue-des-champions': w('Ligue des champions', 'Compétition européenne de clubs la plus prestigieuse, à l’hymne célèbre.'),
        'ligue-europa': w('Ligue Europa', 'Compétition européenne de clubs de l’UEFA, dont les matchs se jouent le jeudi soir.'),
        'coupe-du-monde': w('Coupe du monde', 'Tournoi mondial des sélections nationales, organisé tous les quatre ans par la FIFA.'),
        euro: w('Euro', 'Championnat d’Europe des nations, organisé tous les quatre ans par l’UEFA.'),
        'premier-league': w('Premier League', 'Championnat d’Angleterre de première division, réputé le plus riche du monde.'),
        liga: w('Liga', 'Championnat d’Espagne de première division, longtemps dominé par Madrid et Barcelone.'),
        'serie-a': w('Serie A', 'Championnat d’Italie de première division, réputé pour sa rigueur défensive.'),

        // Règles et déroulement du match
        penalty: w('Penalty', 'Tir au but accordé après une faute dans la surface, frappé à onze mètres.'),
        'carton-rouge': w('Carton rouge', 'Sanction de l’arbitre qui exclut aussitôt un joueur pour le reste du match.'),
        'coup-franc': w('Coup franc', 'Tir accordé après une faute, frappé ballon arrêté, souvent face à un mur.'),
        corner: w('Corner', 'Ballon remis en jeu depuis un coin du terrain, après une sortie derrière la ligne de but.'),
        touche: w('Touche', 'Remise en jeu à deux mains depuis la ligne de côté, quand le ballon sort latéralement.'),
        'hors-jeu': w('Hors-jeu', 'Position irrégulière d’un attaquant trop avancé au moment où on lui passe le ballon.'),
        main: w('Main', 'Faute sifflée quand un joueur de champ touche le ballon avec le bras.'),
        var: w('VAR', 'Assistance vidéo à l’arbitrage, qui revoit les actions litigieuses sur écran.'),
        'juge-de-touche': w('Juge de touche', 'Arbitre assistant qui longe la ligne de côté, drapeau en main, pour signaler les fautes.'),
        prolongations: w('Prolongations', 'Deux périodes de quinze minutes jouées en cas d’égalité dans un match à élimination.'),
        'temps-additionnel': w('Temps additionnel', 'Minutes ajoutées par l’arbitre en fin de période pour compenser les arrêts de jeu.'),

        // Gestes techniques
        roulette: w('Roulette', 'Dribble où le joueur pivote sur lui-même en faisant rouler le ballon sous ses semelles.'),
        'petit-pont': w('Petit pont', 'Dribble qui consiste à faire passer le ballon entre les jambes d’un adversaire.'),
        volee: w('Volée', 'Frappe qui reprend le ballon dans les airs, avant qu’il ne touche le sol.'),
        retourne: w('Retourné', 'Geste acrobatique où le joueur, dos au but, frappe par-dessus sa tête en basculant.'),
        panenka: w('Panenka', 'Penalty tiré en pichenette au centre du but, pendant que le gardien plonge.'),
        lob: w('Lob', 'Ballon frappé en cloche pour passer par-dessus un adversaire, souvent le gardien.'),

        // Trophées, stades et tribunes
        'ballon-d-or': w('Ballon d’Or', 'Trophée créé par France Football en 1956, qui récompense le meilleur joueur de l’année.'),
        'soulier-d-or': w('Soulier d’or', 'Trophée européen remis chaque saison au meilleur buteur des championnats du continent.'),
        'stade-de-france': w('Stade de France', 'Plus grand stade du pays, situé à Saint-Denis et inauguré pour le Mondial 1998.'),
        'parc-des-princes': w('Parc des Princes', 'Enceinte du 16e arrondissement de Paris, antre historique du PSG.'),
        velodrome: w('Vélodrome', 'Enceinte de l’Olympique de Marseille, célèbre pour l’ambiance de ses virages.'),
        'geoffroy-guichard': w('Geoffroy-Guichard', 'Stade de l’AS Saint-Étienne, surnommé le Chaudron pour son ambiance bouillante.'),
        tifo: w('Tifo', 'Grande animation visuelle déployée par les supporters dans une tribune avant le match.'),
        ola: w('Ola', 'Vague humaine où les spectateurs se lèvent tour à tour, les bras en l’air.'),
      },
      pairs: [
        // Joueurs et entraîneurs
        p('messi', 'maradona', 'Légendes du ballon rond'),
        p('messi', 'ronaldinho', 'Stars du ballon rond'),
        p('ronaldinho', 'neymar', 'Stars du ballon rond'),
        p('neymar', 'cristiano-ronaldo', 'Stars du ballon rond'),
        p('cristiano-ronaldo', 'mbappe', 'Grands attaquants'),
        p('maradona', 'zidane', 'Légendes du ballon rond'),
        p('zidane', 'platini', 'Légendes du football français'),
        p('henry', 'mbappe', 'Joueurs de l’équipe de France'),
        p('henry', 'giroud', 'Buteurs de l’équipe de France'),
        p('giroud', 'benzema', 'Attaquants de l’équipe de France'),
        p('kante', 'pogba', 'Joueurs de l’équipe de France'),
        p('lloris', 'barthez', 'Champions du monde français'),
        p('deschamps', 'laurent-blanc', 'Figures du football français'),

        // Clubs
        p('psg', 'monaco', 'Clubs français'),
        p('psg', 'lyon', 'Clubs français'),
        p('marseille', 'lens', 'Clubs français'),
        p('marseille', 'saint-etienne', 'Clubs français historiques'),
        p('real-madrid', 'bayern', 'Grands clubs européens'),
        p('real-madrid', 'ac-milan', 'Grands clubs européens'),
        p('juventus', 'ac-milan', 'Grands clubs européens'),
        p('barcelone', 'juventus', 'Grands clubs européens'),
        p('barcelone', 'man-city', 'Grands clubs européens'),
        p('liverpool', 'dortmund', 'Grands clubs européens'),
        p('liverpool', 'man-united', 'Grands clubs européens'),

        // Compétitions
        p('ligue-des-champions', 'ligue-europa', 'Grandes compétitions'),
        p('coupe-du-monde', 'euro', 'Grandes compétitions'),
        p('premier-league', 'liga', 'Championnats nationaux'),
        p('liga', 'serie-a', 'Championnats nationaux'),

        // Règles et déroulement du match
        p('penalty', 'carton-rouge', 'Décisions de l’arbitre'),
        p('penalty', 'coup-franc', 'Phases de jeu'),
        p('coup-franc', 'corner', 'Phases de jeu'),
        p('corner', 'touche', 'Règles du jeu'),
        p('hors-jeu', 'main', 'Règles du jeu'),
        p('var', 'juge-de-touche', 'Arbitrage'),
        p('prolongations', 'temps-additionnel', 'Déroulement d’un match'),

        // Gestes techniques
        p('roulette', 'petit-pont', 'Gestes techniques'),
        p('volee', 'retourne', 'Gestes techniques'),
        p('panenka', 'lob', 'Gestes techniques'),

        // Trophées, stades et tribunes
        p('ballon-d-or', 'soulier-d-or', 'Récompenses et trophées'),
        p('stade-de-france', 'parc-des-princes', 'Enceintes sportives'),
        p('parc-des-princes', 'velodrome', 'Enceintes sportives'),
        p('velodrome', 'geoffroy-guichard', 'Enceintes sportives'),
        p('tifo', 'ola', 'Ambiance au stade'),
      ],
    }),
  ],
});
