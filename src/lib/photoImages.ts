type PhotoImageEntry = {
  data: {
    src: string;
    thumb?: string;
  };
};

export function photoDisplaySrc(photo: PhotoImageEntry) {
  return photo.data.src;
}

export function photoThumbSrc(photo: PhotoImageEntry) {
  return photo.data.thumb ?? photo.data.src;
}

export function photoAmbientSrc(photo: PhotoImageEntry) {
  return photo.data.thumb ?? photo.data.src;
}
