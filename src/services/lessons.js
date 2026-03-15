const LESSONS = [
  {
    number: 1,
    title: 'Introduction to Market Structure',
    description: 'Learn the basics of how markets move — higher highs, higher lows, and trend identification. Understanding market structure is the foundation of all technical analysis.',
    imageUrl: 'https://otg-academy.netlify.app/images/lesson1-market-structure.png',
    sourceUrl: 'https://otg-academy.netlify.app/lessons/1',
    reviewQuestion: 'What defines an uptrend in market structure?',
    reviewOptions: [
      { label: 'Higher highs and higher lows', value: 'hh_hl', correct: true },
      { label: 'Lower highs and lower lows', value: 'lh_ll', correct: false },
      { label: 'Equal highs and equal lows', value: 'eh_el', correct: false },
      { label: 'Random price movement', value: 'random', correct: false },
    ],
  },
  {
    number: 2,
    title: 'Understanding EMA Support & Resistance',
    description: 'Exponential Moving Averages (EMAs) act as dynamic support and resistance levels. Learn how the 50, 200, and 548 EMAs guide trading decisions and signal trend strength.',
    imageUrl: 'https://otg-academy.netlify.app/images/lesson2-ema-support.png',
    sourceUrl: 'https://otg-academy.netlify.app/lessons/2',
    reviewQuestion: 'Which EMA is commonly used as the strongest long-term support?',
    reviewOptions: [
      { label: '50 EMA', value: '50_ema', correct: false },
      { label: '200 EMA', value: '200_ema', correct: true },
      { label: '10 EMA', value: '10_ema', correct: false },
      { label: '5 EMA', value: '5_ema', correct: false },
    ],
  },
  {
    number: 3,
    title: 'Risk Management & Position Sizing',
    description: 'The most important skill in trading is managing risk. Learn how to size positions based on your portfolio, set stop losses, and protect your capital for long-term success.',
    imageUrl: 'https://otg-academy.netlify.app/images/lesson3-risk-management.png',
    sourceUrl: 'https://otg-academy.netlify.app/lessons/3',
    reviewQuestion: 'What is the recommended maximum risk per trade for beginners?',
    reviewOptions: [
      { label: '1-2% of portfolio', value: '1_2_pct', correct: true },
      { label: '10-20% of portfolio', value: '10_20_pct', correct: false },
      { label: '50% of portfolio', value: '50_pct', correct: false },
      { label: 'All in every time', value: 'all_in', correct: false },
    ],
  },
];

function getLesson(number) {
  return LESSONS.find(l => l.number === number) || null;
}

function getAllLessons() {
  return LESSONS;
}

module.exports = { getLesson, getAllLessons };
