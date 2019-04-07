export const maxRetries = 5;
export const maxTimeout = 2500;
export const defaultInterval = (tries: number) => {
  switch (tries) {
    case 0:
      return 100;
    case 1:
      return 200;
    case 2:
      return 400;
    case 3:
      return 800;
    case 4:
      return 1600;
    default:
      return 3200;
  }
};
