import axios, { AxiosError } from 'axios';
import jsdom, { JSDOM } from 'jsdom';


async function extractData(urls: string[]): Promise<IIntegration[]> {
  const results: IIntegration[] = [];
  const requests = urls.map(
    async (url): Promise<IDocument> => await fetchPage(url)
  );
  const dataPages: IPage[] = await Promise.all(requests)
    .then((responses) => {
      const dataPages: IPage[] = [];
      responses
        .filter((response) => response !== null)
        .forEach(({ document, url }): void => {
          const output: Output = JSON.parse(
            document.querySelector('[type*=application]').textContent
          );
          dataPages.push({ output, url });
        });
      return dataPages;
    })
    .catch((e) => {
      console.log(`Integration of touslesfestivals failed with error : ${e}`);
      return [];
    });
  for (const data of dataPages) {
    const output = data.output;
    const occurrences: IOccurenceIntegration[] =
      output.subEvents?.length > 0
        ? output.subEvents.map((event) => {
            const startDate = new Date(event.startDate);
            const endDate = new Date(startDate);
            endDate.setHours(startDate.getHours() + 4);
            return {
              startDate,
              endDate,
              endDateIsNotReliable: true,
              notAvailable: !event.eventStatus.match('EventScheduled')
                ? new Date()
                : null,
            };
          })
        : [
            {
              startDate: output.startDate,
              endDate: output.endDate,
              endDateIsNotReliable: true,
            },
          ];
    let description = '<p>Retrouvez les artistes :';
    const searchInfo = output.subEvents
      .map((subEvent) => subEvent.performers.map((performer) => performer.name))
      .flat();
    for (const performer of searchInfo) {
      description += ` ${performer},`;
    }
    description = description.replace(/,$/g, '.');
    description += '</p>';
    results.push({
      event: {
        name: output.name,
        startDate: output.startDate,
        endDate: output.endDate,
        endDateIsNotReliable: true,
        isCertified: true,
        lowerPrice: null,
        upperPrice: null,
        description,
        participantsNumber: null,
        image: output.image,
        source: 'touslesfestivals',
        searchInfo,
        onlyLinkMatching: true,
        cantRetrieveOccurrences: false,
      },
      eventLink: { link: data.url, bookable: false },
      address: {
        coordinates: [
          Number(output.location.longitude),
          Number(output.location.latitude),
        ],
        street: output.location.address.streetAddress || output.location.name,
        city: output.location.address.addressLocality,
        postalCode: output.location.address.postalCode,
        country: output.location.address.addressCountry,
      },
      place: {
        name: output.location.name,
        description: null,
      },
      placeLink: null,
      categories: [Category.Festival],
      occurrences,
    });
  }
  return results;
}

export async function perform(): Promise<void> {
  let i = 1;
  let stop = false;
  while (!stop) {
    const { document } = await fetchPage(
      `https://www.touslesfestivals.com/agenda/liste?page=${i}`
    );
    const urls = document.querySelector('.agenda-full-link')
      ? Array.from(document.querySelectorAll('.agenda-full-link')).map(
          (element) => element.getAttribute('href')
        )
      : null;
    if (!urls) {
      stop = true;
    } else {
      const data = await extractData(urls);
      //await integrate(data);
	  consol.log(data);
      i += 1;
    }
  }
}

interface IPage {
  output: Output;
  url: string;
}

interface Output {
  name: string;
  organizer: {
    name: string;
    // possibility to have url immediately
    url: string;
  };
  // shoul include EventScheduled
  eventStatus: string;
  image: string;
  location: {
    name: string;
    address: {
      streetAddress: string;
      postalCode: string;
      addressLocality: string;
      addressRegion: string;
      addressCountry: string;
    };
    latitude: string;
    longitude: string;
  };
  startDate: Date;
  endDate: Date;
  subEvents: Array<{
    startDate: Date;
    eventStatus: string;
    performers: Array<{
      name: string;
    }>;
  }>;
}

export async function fetchPage(
  url: string,
  cloudFront = false
): Promise<IDocument | null> {
  console.log(`Getting data for ${url}...`);
  return await axios
    .get(url, {
      headers: {
        'Accept-Encoding': '*',
        ...(cloudFront
          ? {
              'User-Agent':
                'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.0.0 Mobile Safari/537.36',
            }
          : {}),
      },
      // timeout: 5000,
    })
    .then((res) => {
      // in order to avoid error : Could not parse CSS stylesheet in the console
      const virtualConsole = new jsdom.VirtualConsole();
      return {
        document: new JSDOM(res.data, { virtualConsole }).window.document,
        url,
      };
    })
    .catch((error: AxiosError) => {
      console.log(
        `Not able to retrieve url : ${url}. Error : ${JSON.stringify(error)}`
      );
      return null;
    });
}

export enum Category {
  ///
  Art = 'art, poesie',
  Peinture = 'peinture, painting, toile, paint',
  Streetart = 'streetart, street/art, graffiti/mural',
  Photo = 'photo',
  Sculpture = 'sculpture',
  Fashion = 'fashion',
  //
  ///
  Atelier = 'atelier, workshop, cours/de',
  AtelierArtisanal = 'atelier/artisanal, atelier/bijoux, atelier/couture, atelier/textile, atelier/cosmetique, atelier/parfum, moulage, céramique, gravure, broderie, craft',
  AtelierGourmand = 'atelier/gourmand, atelier/degustation, atelier/gastronomie, atelier/culinaire',
  AtelierNature = 'atelier/nature, atlier/terrarium, atelier/vegetal',
  AtelierArtistique = 'atelier/artistique, atelier/danse, atelier/art',
  AtelierZen = 'atelier/zen, zen, spirituality, yoga, meditation',
  //
  Brocante = 'brocante, vide/grenier',
  ///
  Cinema = 'cinema, movie, film',
  Projection = 'projection',
  //
  Meeting = 'meeting, rencontre, community, cafe/theatre',
  ///
  Soiree = 'soiree, party, fete',
  Clubbing = 'clubbing',
  //
  Conference = 'conference, talk, debat',
  Enfants = 'enfants, child, children, kids, enfance',
  Expo = 'expo, exposition, fondation, vernissage, exhibition',
  Festival = 'festival',
  Gastronomie = 'gastronomie, gourmand, vin, wine, food, drink, cuisine, cocktails, degustation, Œnologie',
  Livres = 'livres, book, litterature, bd, bande/dessinee, romans',
  ///
  Loisirs = 'loisirs, hobbies, scavenger hunt, jeu, bowling, parc attraction',
  Escapegame = 'escapegame, escape/game, escape/room',
  Gaming = 'gaming, game',
  //
  ///
  Musique = 'musique, music, concert, dj, gigs, candlelight, musicale, musical, fanfare',
  Rock = 'rock',
  Metal = 'metal',
  // warning classique could be dance or others
  Classique = 'classique, classical, concerto, orchestre, opera',
  HipHop = 'hiphop, hip/hop',
  Electro = 'electro, electronic, electronica',
  House = 'house',
  Jazz = 'jazz',
  Techno = 'techno',
  Rap = 'rap',
  Disco = 'disco',
  Pop = 'pop',
  Chanson = 'chanson',
  //
  ///
  Nature = 'nature, garden, plante, fleur, travel, outdoor, parc',
  Balade = 'balade',
  //
  Pro = 'pro, professionnel, business, career, marketing, investment, politics, formation, manager, metier, entrepreneur, entrepreneurial, reseautage',
  Salon = 'salon, forum',
  Sciences = 'sciences, medicine, technologie, health, medical',
  ///
  Solidarite = 'solidarite, charity, benevolat',
  Ecologie = 'ecologie, ecology, climat',
  //
  ///
  Spectacle = 'spectacle, performance, scene',
  Comedie = 'comedie, comedy',
  StandUp = 'standup, stand/up, one/man/show, cafe/theatre, humoriste, improvisation, impro, one/(wo)man/show',
  Theatre = 'theatre, theater',
  Cabaret = 'cabaret',
  Cirque = 'cirque, circus',
  Magie = 'magie, magic, magique, magicien',
  Opera = 'opera',
  ComedieMusicale = 'comedie/musicale',
  Ballet = 'ballet, spectacle danse',
  //
  ///
  Sport = 'sport, running, fitness, handball, football, rugby',
  // JO2024 = 'jo2024, jeux 2024', deprecated for later maybe
  Course = 'course',
  //
  Visite = 'visite, musee, visit, museum',
}

export interface IDocument {
  document: Document | null;
  url: string;
}

export interface IIntegration {
  event: IEventIntegration;
  address: IAddressIntegration;
  place: IPlaceIntegration;
  creatorId?: number;
  categories?: Category[];
  occurrences: IOccurenceIntegration[];
  eventLink: IEventLinkIntegration;
  placeLink?: string;
}

export interface IEventIntegration {
  name: string;
  startDate: Date;
  endDate: Date;
  endDateIsNotReliable: boolean;
  participantsNumber?: number;
  isCertified: boolean;
  lowerPrice?: number;
  upperPrice?: number;
  description?: string;
  image?: string;
  source: string;
  notAvailable?: Date;
  availabilityLinks?: string[];
  searchInfo?: string[];
  cantRetrieveOccurrences?: boolean;
  shouldCreateNewOccurrences?: boolean;
  onlyLinkMatching?: boolean;
  commissionRate?: number;
  commissionFix?: number;
  earningPerClick?: number;
  sourceEventId?: string;
}

export interface IAddressIntegration {
  coordinates: number[];
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

export interface IPlaceIntegration {
  name: string;
  description?: string;
  image?: string;
  htmlAttributions?: string[];
}

export interface IOccurenceIntegration {
  id?: number;
  startDate: Date;
  endDate: Date;
  endDateIsNotReliable: boolean;
  notAvailable?: Date;
}

export interface IEventLinkIntegration {
  link: string;
  affiliateLink?: string;
  otherLink?: string;
  bookable?: boolean;
}
