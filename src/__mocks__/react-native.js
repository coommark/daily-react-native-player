module.exports = {
  Platform: {
    OS: 'ios',
    select: (spec) => spec.ios ?? spec.default,
  },
};
