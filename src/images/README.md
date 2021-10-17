# Image Copyright

## frigate-bird-in-sky.jpg

**Link**: https://www.flickr.com/photos/dianasch/47543120431

**Description**: A Frigate bird with a very large wingspan (7 ft) soaring overhead on Sanibel Island, Florida.

**Copyright**: Diana Robinson

**License**: https://creativecommons.org/licenses/by-nc-nd/2.0/

**Modifications**:

* Cropped for 16:9
* Scaled down to 492x277
* Gaussian blur 0.01
* Quality @ 85%

```sh
$ convert -extent 2048x1152 -gravity center -47543120431_b285c45ac8_k.jpg output.jpg
$ mogrify -strip -interlace Plane -gaussian-blur 0.01 -quality 85% -scale 492x277 output.jpg
```
