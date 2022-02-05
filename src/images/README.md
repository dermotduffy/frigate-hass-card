# Image Copyright

## frigate-bird-in-sky.jpg

**Link**: https://www.flickr.com/photos/dianasch/47543120431

**Description**: A Frigate bird with a very large wingspan (7 ft) soaring overhead on Sanibel Island, Florida.

**Copyright**: Diana Robinson

**License**: https://creativecommons.org/licenses/by-nc-nd/2.0/

**Image Formatting Process**:

* Horizontal mirror (to face the opposite direction)
* Cropped for 16:9
* Scaled down to 492x277
* Quality @ 85%

```sh
$ convert -extent 2048x1152 -flop -gravity center 47543120431_b285c45ac8_k.jpg frigate-bird-in-sky.jpg
$ mogrify -strip -interlace Plane -quality 85% -scale 492x277 frigate-bird-in-sky.jpg
```
