// ^[A-Za-z]{6}[0-9LMNPQRSTUV]{2}[A-Za-z]{1}[0-9LMNPQRSTUV]{2}[A-Za-z]{1}[0-9LMNPQRSTUV]{3}[A-Za-z]{1}$
const codeMask = [
  ...new Array(6).fill(/[A-Za-z]/),
  ...new Array(2).fill(/[0-9LMNPQRSTUV]/),
  /[A-Za-z]/,
  ...new Array(2).fill(/[0-9LMNPQRSTUV]/),
  /[A-Za-z]/,
  ...new Array(3).fill(/[0-9LMNPQRSTUV]/),
  /[A-Za-z]/
];

module.exports.codeMask = codeMask;

// ^[0123][0-9]{17}$
const noticeMask = [/[0123]/, ...new Array(17).fill(/[0-9]/)];

module.exports.noticeMask = noticeMask;

// 1-9999999999
const amountMask = [/[1-9]/, ...new Array(9).fill(/[0-9]/)];

module.exports.amountMask = amountMask;