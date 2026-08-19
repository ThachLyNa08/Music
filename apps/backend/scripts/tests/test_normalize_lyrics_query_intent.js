const assert = require('assert');
const { normalizeLyricsQueryIntent } = require('../../src/utils/vietnameseText.util');

const requiredCases = [
  ['Bài gì mà có câu em của ngày hôm qua', 'em cua ngay hom qua'],
  ['Bài nào mà có câu chúng ta của hiện tại', 'chung ta cua hien tai'],
  ['Bài hát nào chứa câu em vẫn nhớ', 'em van nho'],
  ['Tìm bài chứa câu nếu ngày ấy', 'neu ngay ay'],
  ['Tìm bài hát chứa đoạn đừng hỏi em', 'dung hoi em'],
  ['Tìm bài từ câu vì anh đâu có biết', 'vi anh dau co biet'],
  ['Tìm bài hát từ lời một bước yêu vạn dặm đau', 'mot buoc yeu van dam dau'],
  ['Tìm bài dựa vào lời có chắc yêu là đây', 'co chac yeu la day'],
  ['Câu này nằm trong bài nào em đi xa quá', 'em di xa qua'],
  ['Đoạn này thuộc bài hát nào nếu ngày ấy', 'neu ngay ay'],
  ['Đây là lời bài gì em của ngày hôm qua', 'em cua ngay hom qua'],
  ['Đây là lời bài hát nào chúng ta của hiện tại', 'chung ta cua hien tai'],
  ['Câu này là bài gì một bước yêu vạn dặm đau', 'mot buoc yeu van dam dau'],
  ['Mình nhớ mang máng câu có chắc yêu là đây', 'co chac yeu la day'],
  ['Tôi nhớ mang máng đoạn đừng hỏi em', 'dung hoi em'],
  ['Tôi nhớ là câu em gái mưa', 'em gai mua'],
  ['Hình như có câu em của ngày hôm qua', 'em cua ngay hom qua'],
  ['Có câu hát chúng ta không thuộc về nhau', 'chung ta khong thuoc ve nhau'],
  ['Bài gì có đoạn nơi này có anh', 'noi nay co anh'],
  ['Bài nào mà có đoạn chúng ta của hiện tại', 'chung ta cua hien tai'],
  ['em của ngày hôm qua nằm trong bài nào', 'em cua ngay hom qua'],
  ['chúng ta của hiện tại nằm trong bài hát nào', 'chung ta cua hien tai'],
  ['nếu ngày ấy thuộc bài nào', 'neu ngay ay'],
  ['đừng hỏi em thuộc bài hát nào', 'dung hoi em'],
  ['một bước yêu vạn dặm đau là của bài nào', 'mot buoc yeu van dam dau'],
];

const existingRegressionCases = [
  ['Tìm lời bài hát em của ngày hôm qua', 'em cua ngay hom qua'],
  ['Bài nào có lời em của ngày hôm qua', 'em cua ngay hom qua'],
  ['Bài hát nào có câu em của ngày hôm qua', 'em cua ngay hom qua'],
  ['Nhớ câu em của ngày hôm qua', 'em cua ngay hom qua'],
  ['lyrics em của ngày hôm qua', 'em cua ngay hom qua'],
  ['câu hát em của ngày hôm qua', 'em cua ngay hom qua'],
];

const negativeRegressionCases = [
  ['em gái mưa', 'em gai mua'],
  ['có chắc yêu là đây', 'co chac yeu la day'],
  ['nhạc buồn buổi tối', 'nhac buon buoi toi'],
  ['Sơn Tùng', 'son tung'],
  ['Love Story', 'love story'],
  ['bài này chill quá', 'bai nay chill qua'],
];

const cases = [
  ...requiredCases,
  ...existingRegressionCases,
  ...negativeRegressionCases,
];

let passed = 0;

for (const [input, expected] of cases) {
  const actual = normalizeLyricsQueryIntent(input);
  assert.strictEqual(actual, expected, `${input} => ${actual}, expected ${expected}`);
  passed += 1;
}

console.log(`[normalize-lyrics-query-intent] PASS ${passed}/${cases.length}`);
