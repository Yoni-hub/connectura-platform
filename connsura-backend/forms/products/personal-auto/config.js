window.personalAutoConfig = {
  buttons: {
    prev: 'Previous',
    next: 'Next',
    save: 'Save',
    share: 'Share',
  },
  visibleByStep: {
    1: { prev: false, next: true, save: false, share: false },
    2: { prev: true, next: true, save: false, share: false },
    3: { prev: true, next: true, save: false, share: false },
    4: { prev: true, next: true, save: false, share: false },
    5: { prev: true, next: true, save: false, share: false },
    6: { prev: true, next: true, save: false, share: false },
    7: { prev: true, next: false, save: true, share: true },
  },
  handlers: {
    save: () => alert('Saved'),
    share: () => alert('Shared'),
  },
};
