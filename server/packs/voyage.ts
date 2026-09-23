import { definePack, p, universe, w } from './types';

export default definePack({
  id: 'voyage',
  name: 'Voyage & Lieux',
  description: "Capitales, paysages de rêve et tout ce qu'il faut pour partir.",
  icon: 'plane',
  universes: [
    universe({
      id: 'general',
      name: 'Voyage & Lieux',
      precise: false,
      words: {
        // Villes
        paris: w('Paris', 'Capitale de la France traversée par la Seine, surnommée la Ville Lumière.'),
        rome: w('Rome', 'Capitale de l’Italie traversée par le Tibre, surnommée la Ville éternelle.'),
        londres: w('Londres', 'Capitale du Royaume-Uni traversée par la Tamise, célèbre pour Big Ben.'),
        berlin: w('Berlin', 'Capitale de l’Allemagne, divisée par un mur de 1961 à 1989.'),
        newyork: w('New York', 'Plus grande ville des États-Unis, célèbre pour Manhattan et Times Square.'),
        losangeles: w('Los Angeles', 'Grande ville de Californie qui abrite Hollywood, haut lieu du cinéma.'),
        lasvegas: w('Las Vegas', 'Ville du Nevada célèbre pour ses casinos et ses spectacles.'),
        dubai: w('Dubaï', 'Émirat du golfe Persique où se dresse la tour Burj Khalifa.'),
        venise: w('Venise', 'Ville italienne bâtie sur une lagune, où l’on circule en gondole.'),
        amsterdam: w('Amsterdam', 'Capitale des Pays-Bas, connue pour ses canaux et ses vélos.'),

        // Monuments et sites
        toureiffel: w('Tour Eiffel', 'Tour de fer puddlé bâtie à Paris pour l’Exposition universelle de 1889.'),
        statue: w('Statue de la Liberté', 'Colosse brandissant une torche à l’entrée du port de New York depuis 1886.'),
        colisee: w('Colisée', 'Amphithéâtre antique de Rome où s’affrontaient les gladiateurs.'),
        acropole: w('Acropole', 'Colline d’Athènes couronnée par le Parthénon et d’autres temples antiques.'),
        montsaintmichel: w('Mont-Saint-Michel', 'Îlot rocheux coiffé d’une abbaye, cerné par les grandes marées d’une baie.'),
        carcassonne: w('Carcassonne', 'Cité médiévale fortifiée de l’Aude, entourée d’une double ligne de remparts.'),

        // Pays
        espagne: w('Espagne', 'Pays dont la capitale est Madrid, célèbre pour le flamenco et la paella.'),
        portugal: w('Portugal', 'Pays dont la capitale est Lisbonne, célèbre pour le fado et le pastel de nata.'),
        italie: w('Italie', 'Pays en forme de botte dont la capitale est Rome, patrie de la pizza.'),
        grece: w('Grèce', 'Pays aux nombreuses îles dont la capitale est Athènes.'),
        japon: w('Japon', 'Archipel d’Asie dont la capitale est Tokyo, pays des sushis et des mangas.'),
        coree: w('Corée du Sud', 'Pays d’Asie dont la capitale est Séoul, patrie de la K-pop.'),
        maroc: w('Maroc', 'Pays d’Afrique du Nord dont la capitale est Rabat, célèbre pour Marrakech.'),
        tunisie: w('Tunisie', 'Pays d’Afrique du Nord dont la capitale est Tunis, célèbre pour l’île de Djerba.'),
        egypte: w('Égypte', 'Pays d’Afrique traversé par le Nil, célèbre pour les pharaons de l’Antiquité.'),
        mexique: w('Mexique', 'Pays dont la capitale est Mexico, héritier des civilisations aztèque et maya.'),
        bresil: w('Brésil', 'Plus grand pays d’Amérique du Sud, célèbre pour le carnaval de Rio.'),
        argentine: w('Argentine', 'Pays d’Amérique du Sud dont la capitale est Buenos Aires, terre du tango.'),
        suisse: w('Suisse', 'Pays alpin neutre aux quatre langues nationales, réputé pour son chocolat.'),
        autriche: w('Autriche', 'Pays alpin germanophone dont la capitale est Vienne, patrie de Mozart.'),

        // Régions et îles
        bretagne: w('Bretagne', 'Région de l’ouest de la France, terre de crêpes et de menhirs.'),
        normandie: w('Normandie', 'Région du nord-ouest de la France, terre du camembert et du Débarquement.'),
        corse: w('Corse', 'Île française de Méditerranée, surnommée l’île de Beauté.'),
        sardaigne: w('Sardaigne', 'Grande île italienne de Méditerranée, connue pour la Costa Smeralda.'),
        maldives: w('Maldives', 'Archipel d’atolls de l’océan Indien, parmi les pays les plus plats du monde.'),
        seychelles: w('Seychelles', 'Archipel de l’océan Indien au large de l’Afrique, réputé pour ses rochers de granit.'),

        // Paysages
        montagne: w('Montagne', 'Relief très élevé aux pentes raides, parfois enneigé au sommet.'),
        volcan: w('Volcan', 'Relief d’où peuvent jaillir lave, cendres et gaz venus des profondeurs.'),
        foret: w('Forêt', 'Vaste étendue couverte d’arbres, de sous-bois et de sentiers.'),
        jungle: w('Jungle', 'Végétation tropicale dense et humide, riche en lianes et en animaux sauvages.'),
        desert: w('Désert', 'Région très sèche où il pleut rarement, souvent faite de sable ou de roche.'),
        savane: w('Savane', 'Vaste plaine herbeuse parsemée d’arbres, typique de l’Afrique tropicale.'),
        lac: w('Lac', 'Étendue d’eau entourée de terres, comme celui d’Annecy ou le Léman.'),
        riviere: w('Rivière', 'Cours d’eau naturel qui se jette dans un autre cours d’eau.'),
        plage: w('Plage', 'Étendue de sable ou de galets au bord de la mer ou d’un océan.'),
        piscine: w('Piscine', 'Bassin artificiel rempli d’eau, souvent chlorée, pour nager.'),

        // Transports
        avion: w('Avion', 'Appareil à ailes fixes qui décolle et atterrit sur une piste.'),
        helicoptere: w('Hélicoptère', 'Appareil volant à rotor qui décolle à la verticale et fait du surplace.'),
        train: w('Train', 'Convoi de wagons sur rails qui relie les villes entre elles.'),
        metro: w('Métro', 'Réseau ferré urbain, souvent souterrain, qui dessert une grande ville.'),
        paquebot: w('Paquebot', 'Grand navire de luxe transportant des passagers, comme le Titanic.'),
        ferry: w('Ferry', 'Navire qui fait la navette entre deux ports avec passagers et véhicules.'),

        // Hébergements
        hotel: w('Hôtel', 'Établissement qui loue des chambres à la nuit, avec accueil et service.'),
        gite: w('Gîte', 'Logement meublé à la campagne, loué pour les vacances.'),
        chalet: w('Chalet', 'Maison en bois typique des Alpes, au toit largement débordant.'),
        refuge: w('Refuge', 'Abri de haute montagne où les randonneurs peuvent dormir et manger.'),
        tente: w('Tente', 'Abri de toile monté sur des arceaux et fixé au sol par des piquets.'),
        campingcar: w('Camping-car', 'Véhicule aménagé avec couchettes et coin cuisine pour voyager.'),

        // Lieux de départ et sorties
        aeroport: w('Aéroport', 'Lieu équipé de pistes et de terminaux d’où partent les vols.'),
        gare: w('Gare', 'Bâtiment où les voyageurs montent et descendent des trains.'),
        disneyland: w('Disneyland', 'Complexe de loisirs de Marne-la-Vallée où l’on croise Mickey et ses amis.'),
        asterix: w('Parc Astérix', 'Parc de loisirs de l’Oise inspiré d’une bande dessinée sur les Gaulois.'),

        // Préparatifs
        passeport: w('Passeport', 'Livret officiel avec photo, exigé pour entrer dans de nombreux pays.'),
        carteid: w("Carte d'identité", 'Petit document officiel avec photo qui prouve qui l’on est.'),
        visa: w('Visa', 'Autorisation d’entrée dans un pays étranger, à obtenir avant le départ.'),
        valise: w('Valise', 'Bagage rigide ou souple à poignée, souvent muni de roulettes.'),
        sacados: w('Sac à dos', 'Sac porté sur le dos grâce à deux bretelles, prisé des randonneurs.'),
      },
      pairs: [
        p('paris', 'rome', 'Capitales européennes'),
        p('paris', 'londres', 'Grandes villes d’Europe'),
        p('paris', 'newyork', 'Villes mythiques'),
        p('londres', 'berlin', 'City-trips en Europe'),
        p('newyork', 'losangeles', 'Métropoles américaines'),
        p('losangeles', 'lasvegas', 'Villes des États-Unis'),
        p('lasvegas', 'dubai', 'Villes de la démesure'),
        p('venise', 'amsterdam', 'Escapades romantiques'),

        p('toureiffel', 'statue', 'Monuments emblématiques'),
        p('toureiffel', 'colisee', 'Monuments célèbres'),
        p('colisee', 'acropole', 'Monuments de l’Antiquité'),
        p('montsaintmichel', 'carcassonne', 'Patrimoine français'),

        p('espagne', 'portugal', 'Pays d’Europe du Sud'),
        p('espagne', 'italie', 'Destinations ensoleillées'),
        p('italie', 'grece', 'Pays méditerranéens'),
        p('japon', 'coree', 'Pays d’Asie'),
        p('maroc', 'tunisie', 'Pays d’Afrique'),
        p('egypte', 'mexique', 'Pays de civilisations anciennes'),
        p('mexique', 'bresil', 'Pays d’Amérique latine'),
        p('bresil', 'argentine', 'Pays d’Amérique du Sud'),
        p('suisse', 'autriche', 'Pays européens'),

        p('bretagne', 'normandie', 'Régions françaises'),
        p('corse', 'sardaigne', 'Îles de Méditerranée'),
        p('corse', 'bretagne', 'Vacances en France'),
        p('maldives', 'seychelles', 'Îles paradisiaques'),

        p('montagne', 'volcan', 'Reliefs terrestres'),
        p('foret', 'jungle', 'Milieux naturels'),
        p('desert', 'savane', 'Grands espaces sauvages'),
        p('lac', 'riviere', 'Paysages d’eau douce'),
        p('plage', 'piscine', 'Lieux de baignade'),
        p('plage', 'lac', 'Sorties d’été'),

        p('avion', 'helicoptere', 'Moyens de transport'),
        p('avion', 'train', 'Façons de voyager'),
        p('train', 'metro', 'Transports en commun'),
        p('paquebot', 'ferry', 'Navigation'),

        p('hotel', 'gite', 'Hébergements de vacances'),
        p('gite', 'chalet', 'Locations de vacances'),
        p('chalet', 'refuge', 'Séjours à la montagne'),
        p('tente', 'campingcar', 'Vacances en plein air'),

        p('aeroport', 'gare', 'Lieux de départ'),
        p('disneyland', 'asterix', 'Sorties en famille'),

        p('passeport', 'carteid', 'Papiers officiels'),
        p('passeport', 'visa', 'Formalités de voyage'),
        p('valise', 'sacados', 'Préparatifs de départ'),
      ],
    }),
  ],
});
