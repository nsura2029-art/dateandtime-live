/**
 * Seed script for On This Day data.
 *
 * Populates the API database with curated historical events, births, and deaths.
 * Each entry has Wikipedia URL, importance score, and category.
 *
 * Usage: node scripts/seed-onthisday.js
 *
 * Requires: API_BASE env var (default: https://dev.api.dateandtime.live)
 */

const API_BASE = process.env.API_BASE || 'https://dev.api.dateandtime.live';

// Curated dataset — July 20 events across all 12 categories
const EVENTS = [
  // Space
  { month: 7, day: 20, year: 1969, category: 'event', subcategory: 'space', title: 'Moon landing — Apollo 11', description: 'Apollo 11 lands on the Moon; Armstrong takes "one small step." Apollo 11 was the spaceflight that first landed humans on the Moon. Commander Neil Armstrong and lunar module pilot Buzz Aldrin landed the Apollo Lunar Module Eagle on July 20, 1969, at 20:17 UTC.', importance: 5, wikipedia_url: 'https://en.wikipedia.org/wiki/Apollo_11' },
  { month: 7, day: 20, year: 1969, category: 'event', subcategory: 'space', title: 'First human steps on the Moon', description: 'Neil Armstrong becomes the first person to step onto the Moon\'s surface, followed by Buzz Aldrin. The pair spent about 2 hours and 32 minutes on the lunar surface.', importance: 5, wikipedia_url: 'https://en.wikipedia.org/wiki/Apollo_11' },

  // War / Conflict
  { month: 7, day: 20, year: 1944, category: 'event', subcategory: 'war', title: 'July 20 plot — assassination attempt on Hitler', description: 'Colonel Claus von Stauffenberg attempts to assassinate Adolf Hitler at his Wolf\'s Lair field headquarters by planting a briefcase bomb. Hitler survived with minor injuries. The plot failed and led to the arrest and execution of thousands of suspects.', importance: 5, wikipedia_url: 'https://en.wikipedia.org/wiki/20_July_plot' },
  { month: 7, day: 20, year: 1813, category: 'event', subcategory: 'war', title: 'Battle of Lake Erie — American naval victory', description: 'American naval commander Oliver Hazard Perry defeats the British Royal Navy in the Battle of Lake Erie during the War of 1812. The victory ensured American control of the lake for the rest of the war.', importance: 4, wikipedia_url: 'https://en.wikipedia.org/wiki/Battle_of_Lake_Erie' },

  // Science
  { month: 7, day: 20, year: 2008, category: 'discovery', subcategory: 'science', title: 'Large Hadron Collider powered up at CERN', description: 'The Large Hadron Collider at CERN — described as the biggest scientific experiment in the history of mankind — is powered up in Geneva, Switzerland. It would go on to discover the Higgs boson in 2012.', importance: 4, wikipedia_url: 'https://en.wikipedia.org/wiki/Large_Hadron_Collider' },
  { month: 7, day: 20, year: 1846, category: 'discovery', subcategory: 'invention', title: 'Elias Howe patents the lockstitch sewing machine', description: 'Elias Howe takes out a US patent for his lockstitch sewing machine, revolutionizing the textile and garment industry. His design directly influenced Isaac Singer\'s later improvements.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Elias_Howe' },
  { month: 7, day: 20, year: 1976, category: 'discovery', subcategory: 'space', title: 'Viking 1 lands on Mars', description: 'NASA\'s Viking 1 lander successfully touches down on the surface of Mars, becoming the first American spacecraft to land on the red planet and the first to successfully complete its mission there.', importance: 5, wikipedia_url: 'https://en.wikipedia.org/wiki/Viking_1' },

  // Politics
  { month: 7, day: 20, year: 1977, category: 'event', subcategory: 'politics', title: 'Last person executed by guillotine in France', description: 'Hamida Djandoubi, convicted of torture and murder, becomes the last person to be executed by guillotine in France. France abolished the death penalty in 1981.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Capital_punishment_in_France' },
  { month: 7, day: 20, year: 1924, category: 'event', subcategory: 'crime', title: 'Leopold and Loeb found guilty of "the crime of the century"', description: 'Nathan Leopold and Richard Loeb, the 18- and 19-year-old University of Chicago students who kidnapped and murdered 14-year-old Bobby Franks, are found guilty. Their case inspired the 1959 Hitchcock film "Rope".', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Leopold_and_Loeb' },
  { month: 7, day: 20, year: 1881, category: 'event', subcategory: 'politics', title: 'Sitting Bull surrenders to U.S. Army', description: 'Hunkpapa Lakota holy man and war leader Sitting Bull surrenders to U.S. forces at Fort Buford, Montana, ending his resistance following the Battle of Little Bighorn (1876).', importance: 4, wikipedia_url: 'https://en.wikipedia.org/wiki/Sitting_Bull' },

  // Disasters
  { month: 7, day: 20, year: 2020, category: 'disaster', subcategory: 'wildfire', title: 'California August Complex wildfire becomes largest in state history', description: '471,000 acres (736 square miles) burned — the largest recorded wildfire in California state history at the time. The fire was caused by lightning strikes in mid-August.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/August_Complex_fire' },
  { month: 7, day: 20, year: 2012, category: 'disaster', subcategory: 'shooting', title: 'Aurora, Colorado movie theater shooting', description: 'A mass shooting occurs at a movie theater in Aurora, Colorado during a showing of "The Dark Knight Rises," killing 12 people and injuring 70 others. It remains one of the deadliest mass shootings in U.S. history.', importance: 4, wikipedia_url: 'https://en.wikipedia.org/wiki/2012_Aurora,_Colorado_shooting' },

  // Health / Medicine
  { month: 7, day: 20, year: 1973, category: 'discovery', subcategory: 'health', title: 'Bruce Lee dies at age 32', description: 'Hong Kong-American martial artist and actor Bruce Lee dies in Hong Kong from a cerebral edema, possibly from a reaction to a painkiller. He had been working on his film "Game of Death" at the time of his death.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Bruce_Lee' },

  // First / Notable
  { month: 7, day: 20, year: 1960, category: 'event', subcategory: 'first', title: 'Sirimavo Bandaranaike becomes world\'s first female PM', description: 'Sirimavo Bandaranaike is sworn in as Prime Minister of Sri Lanka, becoming the world\'s first female head of government in modern history. She held the office three times, serving a total of 17 years.', importance: 4, wikipedia_url: 'https://en.wikipedia.org/wiki/Sirimavo_Bandaranaike' },

  // Sports
  { month: 7, day: 20, year: 1972, category: 'event', subcategory: 'sports', title: 'Frank Shorter wins Olympic marathon', description: 'American long-distance runner Frank Shorter wins the men\'s marathon at the Munich Olympics in 2:12:19.8, becoming the first American to win the Olympic marathon since 1908.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Athletics_at_the_1972_Summer_Olympics_%E2%80%93_Men%27s_marathon' },
  { month: 7, day: 20, year: 1969, category: 'event', subcategory: 'sports', title: 'Sports world watches Moon landing, then plays on', description: 'Hours after the Moon landing, the 1969 All-Star Game is played in Washington, D.C. The 1969 MLB All-Star Game would become a cultural moment of national unity following the Apollo 11 mission.', importance: 2, wikipedia_url: 'https://en.wikipedia.org/wiki/1969_Major_League_Baseball_All-Star_Game' },

  // Music
  { month: 7, day: 20, year: 1973, category: 'event', subcategory: 'music', title: 'Bruce Lee dies the day after Enter the Dragon released', description: 'Just one day after the U.S. release of his iconic martial arts film "Enter the Dragon," Bruce Lee dies. The film becomes a massive hit, cementing his legend as a global icon.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Enter_the_Dragon' },
];

// Births on July 20
const BIRTHS = [
  { month: 7, day: 20, year: 1964, category: 'birth', title: 'Jack Ma', description: 'Chinese entrepreneur, founder of Alibaba Group and one of China\'s richest people. Known for his keynote speeches and philanthropy through the Jack Ma Foundation.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Jack_Ma' },
  { month: 7, day: 20, year: 1960, category: 'birth', title: 'Colin Firth', description: 'English actor known for "Pride and Prejudice" (1995) and "The King\'s Speech" (2010), for which he won the Academy Award for Best Actor.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Colin_Firth' },
  { month: 7, day: 20, year: 1982, category: 'birth', title: 'Misty Copeland', description: 'American ballet dancer, author, and activist. In 2015, she became the first African American woman to be promoted to principal dancer in the 75-year history of American Ballet Theatre.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Misty_Copeland' },
  { month: 7, day: 20, year: 1941, category: 'birth', title: 'Paul Anka', description: 'Canadian-American singer, songwriter, and actor. Famous for hit songs like "Diana" (1957), "Put Your Head on My Shoulder" (1959), and writing the theme for "The Tonight Show Starring Johnny Carson."', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Paul_Anka' },
  { month: 7, day: 20, year: 1947, category: 'birth', title: 'Carlos Santana', description: 'Mexican-American guitarist who rose to fame in the late 1960s with his band Santana. Won 10 Grammy Awards and a Latin Grammy Lifetime Achievement Award. Inducted into the Rock and Roll Hall of Fame in 1998.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Carlos_Santana' },
  { month: 7, day: 20, year: 1929, category: 'birth', title: 'Arnold Palmer', description: 'American professional golfer, one of the greatest and most charismatic players in the sport\'s history. The "Arnold Palmer" drink (iced tea and lemonade) is named after him. Won 62 PGA Tour events.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Arnold_Palmer' },
  { month: 7, day: 20, year: 1934, category: 'birth', title: 'Roger Maris', description: 'American professional baseball player who set the MLB single-season home run record with 61 in 1961, breaking Babe Ruth\'s 34-year-old record. The record stood until 1998.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Roger_Maris' },
  { month: 7, day: 20, year: 1938, category: 'birth', title: 'Natalie Wood', description: 'American actress who began her career as a child and became an Academy Award-nominated star. Known for "West Side Story" (1961), "Splendor in the Grass" (1961), and "Bob & Carol & Ted & Alice" (1969).', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Natalie_Wood' },
  { month: 7, day: 20, year: 1938, category: 'birth', title: 'Diana Rigg', description: 'English actress (1938–2020) known for her roles as Emma Peel in "The Avengers" (1965–68) and Olenna Tyrell in "Game of Thrones" (2013–19). Won multiple Emmys and Tonys.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Diana_Rigg' },
  { month: 7, day: 20, year: 1946, category: 'birth', title: 'Kim Carnes', description: 'American singer-songwriter known for her 1981 hit "Bette Davis Eyes," which topped the Billboard Hot 100 for nine weeks and won the Grammy Award for Song of the Year.', importance: 2, wikipedia_url: 'https://en.wikipedia.org/wiki/Kim_Carnes' },
  { month: 7, day: 20, year: 1977, category: 'birth', title: 'Oksana Chusovitina', description: 'Uzbek-German artistic gymnast, one of the oldest Olympic gymnasts ever. Has competed in 8 Olympic Games from 1992 to 2020, winning silver and bronze medals.', importance: 2, wikipedia_url: 'https://en.wikipedia.org/wiki/Oksana_Chusovitina' },
];

// Deaths on July 20
const DEATHS = [
  { month: 7, day: 20, year: 1973, category: 'death', title: 'Bruce Lee', description: 'American-Hong Kong martial artist, actor, and director. Founder of Jeet Kune Do. Star of "Enter the Dragon" (1973). Died at age 32 from a cerebral edema. Became a global cultural icon.', importance: 4, wikipedia_url: 'https://en.wikipedia.org/wiki/Bruce_Lee' },
  { month: 7, day: 20, year: 2002, category: 'death', title: 'Stephen Jay Gould', description: 'American paleontologist, evolutionary biologist, and science historian (1941–2002). Professor at Harvard for 30+ years. Known for the theory of punctuated equilibrium and acclaimed essays in Natural History magazine.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Stephen_Jay_Gould' },
  { month: 7, day: 20, year: 1990, category: 'death', title: 'Terence O\'Neill', description: '4th Prime Minister of Northern Ireland (1914–1990). Served 1963–69 and attempted to reform Northern Ireland\'s treatment of its Catholic minority before being forced to resign.', importance: 2, wikipedia_url: 'https://en.wikipedia.org/wiki/Terence_O%27Neill' },
  { month: 7, day: 20, year: 1957, category: 'death', title: 'Curly Lambeau', description: 'American football player and coach, co-founder of the Green Bay Packers in 1919. Coached the Packers for 31 seasons, winning 6 NFL championships before Vince Lombardi.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Curly_Lambeau' },
  { month: 7, day: 20, year: 1923, category: 'death', title: 'Pancho Villa', description: 'Mexican revolutionary general (1878–1923). One of the most prominent figures of the Mexican Revolution. Assassinated in Hidalgo del Parral. His life inspired numerous films and books.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Pancho_Villa' },
  { month: 7, day: 20, year: 1944, category: 'death', title: 'Claus von Stauffenberg (hours before plot)', description: 'German army officer executed by firing squad the same day for his role in the failed July 20 plot to assassinate Hitler. Beatified by the Catholic Church in 2025.', importance: 3, wikipedia_url: 'https://en.wikipedia.org/wiki/Claus_von_Stauffenberg' },
  { month: 7, day: 20, year: 1973, category: 'death', title: 'Bruce Wood', description: 'American music industry executive, co-founder of the Country Music Association.', importance: 1, wikipedia_url: null },
  { month: 7, day: 20, year: 2018, category: 'death', title: 'Tab Hunter', description: 'American actor, singer, and author (1931–2018). One of the biggest Hollywood stars of the 1950s, and one of the first leading men to publicly acknowledge being gay.', importance: 2, wikipedia_url: 'https://en.wikipedia.org/wiki/Tab_Hunter' },
];

async function postEvent(event) {
  try {
    const res = await fetch(`${API_BASE}/api/v1/onthisday`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    });
    if (!res.ok) {
      console.error(`  ✗ Failed: ${event.title} — ${res.status}`);
      return false;
    }
    console.log(`  ✓ ${event.year}: ${event.title}`);
    return true;
  } catch (e) {
    console.error(`  ✗ Error: ${event.title} — ${e.message}`);
    return false;
  }
}

async function main() {
  console.log(`📅 Seeding On This Day data to ${API_BASE}\n`);

  console.log('=== Events ===');
  for (const e of EVENTS) {
    await postEvent(e);
    await new Promise(r => setTimeout(r, 100)); // rate limit
  }

  console.log('\n=== Births ===');
  for (const b of BIRTHS) {
    await postEvent(b);
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n=== Deaths ===');
  for (const d of DEATHS) {
    await postEvent(d);
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
