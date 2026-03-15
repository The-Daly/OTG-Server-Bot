const CHART_QUESTIONS = [
  {
    id: 'ema_support_1',
    question: 'Where is the strongest EMA support on this chart?',
    imageUrl: 'https://otg-academy.netlify.app/images/chart-training-1.png',
    options: [
      { label: '50 EMA', value: '50_ema' },
      { label: '200 EMA', value: '200_ema' },
      { label: '548 EMA', value: '548_ema' },
      { label: 'No support', value: 'no_support' },
    ],
    correctAnswer: '200_ema',
  },
  {
    id: 'ema_support_2',
    question: 'Price is bouncing off a key level. Which EMA is providing support?',
    imageUrl: 'https://otg-academy.netlify.app/images/chart-training-2.png',
    options: [
      { label: '50 EMA', value: '50_ema' },
      { label: '200 EMA', value: '200_ema' },
      { label: '548 EMA', value: '548_ema' },
      { label: 'No support', value: 'no_support' },
    ],
    correctAnswer: '50_ema',
  },
  {
    id: 'ema_support_3',
    question: 'All EMAs are above price. What does this indicate?',
    imageUrl: 'https://otg-academy.netlify.app/images/chart-training-3.png',
    options: [
      { label: '50 EMA', value: '50_ema' },
      { label: '200 EMA', value: '200_ema' },
      { label: '548 EMA', value: '548_ema' },
      { label: 'No support', value: 'no_support' },
    ],
    correctAnswer: 'no_support',
  },
  {
    id: 'ema_support_4',
    question: 'The 548 EMA has held price for weeks. What is the strongest support?',
    imageUrl: 'https://otg-academy.netlify.app/images/chart-training-4.png',
    options: [
      { label: '50 EMA', value: '50_ema' },
      { label: '200 EMA', value: '200_ema' },
      { label: '548 EMA', value: '548_ema' },
      { label: 'No support', value: 'no_support' },
    ],
    correctAnswer: '548_ema',
  },
];

function getRandomQuestion() {
  return CHART_QUESTIONS[Math.floor(Math.random() * CHART_QUESTIONS.length)];
}

function getQuestion(id) {
  return CHART_QUESTIONS.find(q => q.id === id) || null;
}

module.exports = { getRandomQuestion, getQuestion };
