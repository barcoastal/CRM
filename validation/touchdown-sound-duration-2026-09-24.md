# Match touchdown sound to the celebration

The selected football theme now plays for the full eight-second touchdown, using the first eight seconds of the same video. The audio fade/stop and countdown use the existing shared celebration duration. Dismissal continues to stop the active sound. The old five-second file remains available to existing browser sessions until refresh.

Validation:
- MP3 decodes to exactly 8.000 seconds of stereo 44.1 kHz samples.
- Actual component browser preview: after 5.6 seconds the celebration was visible and the audio source remained playing; at 8.00 seconds the source ended and the overlay closed. Countdown duration: 8 seconds.
- Early dismissal stopped playback at 1.40 seconds and removed the overlay.
- No browser errors; 40 scoreboard/API tests and targeted ESLint passed; diff whitespace check passed.
