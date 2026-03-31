

## EVERY DOCUMENTATION FOR ELLEVENLABS API:


# TTS:
Capabilities
Text to Speech

Copy page

Learn how to turn text into lifelike spoken audio with ElevenLabs.
Overview
ElevenLabs Text to Speech (TTS) API turns text into lifelike audio with nuanced intonation, pacing and emotional awareness. Our models adapt to textual cues across 32 languages and multiple voice styles and can be used to:

Narrate global media campaigns & ads
Produce audiobooks in multiple languages with complex emotional delivery
Stream real-time audio from text
Listen to a sample:


Explore our voice library to find the perfect voice for your project.

The voice library is not available via the API to free tier users.
Products
Step-by-step guide for using text to speech in ElevenLabs.

Developers
Learn how to integrate text to speech into your application.

API reference
Full API reference for the Text to Speech endpoint.

Voice quality
For real-time applications, Flash v2.5 provides ultra-low 75ms latency, while Multilingual v2 delivers the highest quality audio with more nuanced expression.

Eleven v3
Our most emotionally rich, expressive speech synthesis model

Dramatic delivery and performance
70+ languages supported
5,000 character limit
Support for natural multi-speaker dialogue
Eleven Multilingual v2
Lifelike, consistent quality speech synthesis model

Natural-sounding output
29 languages supported
10,000 character limit
Most stable on long-form generations
Eleven Flash v2.5
Our fast, affordable speech synthesis model

Ultra-low latency (~75ms†)
32 languages supported
40,000 character limit
Faster model, 50% lower price per character
Explore all
Voice options
ElevenLabs offers thousands of voices across 32 languages through multiple creation methods:

Voice library with 3,000+ community-shared voices
Professional voice cloning for highest-fidelity replicas
Instant voice cloning for quick voice replication
Voice design to generate custom voices from text descriptions
Learn more about our voice options.

Supported output formats
Supported languages
Our multilingual v2 models support 29 languages:

English (USA, UK, Australia, Canada), Japanese, Chinese, German, Hindi, French (France, Canada), Korean, Portuguese (Brazil, Portugal), Italian, Spanish (Spain, Mexico), Indonesian, Dutch, Turkish, Filipino, Polish, Swedish, Bulgarian, Romanian, Arabic (Saudi Arabia, UAE), Czech, Greek, Finnish, Croatian, Malay, Slovak, Danish, Tamil, Ukrainian & Russian.

Flash v2.5 supports 32 languages - all languages from v2 models plus:

Hungarian, Norwegian & Vietnamese

Simply input text in any of our supported languages and select a matching voice from our voice library. For the most natural results, choose a voice with an accent that matches your target language and region.

Prompting
The models interpret emotional context directly from the text input. For example, adding descriptive text like “she said excitedly” or using exclamation marks will influence the speech emotion. Voice settings like Stability and Similarity help control the consistency, while the underlying emotion comes from textual cues.

Read the prompting guide for more details.

Descriptive text will be spoken out by the model and must be manually trimmed or removed from the audio if desired.

FAQ
Can I clone my own voice?
Do I own the audio output?
What qualifies as a free regeneration?
How do I reduce latency for real-time cases?
Why is my output sometimes inconsistent?
What's the best practice for large text conversions?
Key facts
Determinism: Output is nondeterministic — use the seed parameter for more consistent results
Free regenerations: Up to 2 free regenerations per generation (same content and parameters only)
Ownership: You retain ownership of generated audio; commercial use requires a paid plan
Low-latency use cases: Use Flash models (eleven_flash_v2 or eleven_flash_v2_5) — see the latency optimization guide
Large text: Split long text into segments; use the previous_text / next_text parameters to maintain natural prosody across chunks
Was this page helpful?
Yes
No
Previous
Best practices
Learn how to control delivery, pronunciation, emotion, and optimize text for speech.
Next
Built with


# BEST PRACTICE FOR TTS :

***

title: Best practices
subtitle: >-
Learn how to control delivery, pronunciation, emotion, and optimize text for
speech.
-------

This guide provides techniques to enhance text-to-speech outputs using ElevenLabs models. Experiment with these methods to discover what works best for your needs.

## Controls

<Info>
  We are actively working on *Director's Mode* to give you even greater control over outputs.
</Info>

These techniques provide a practical way to achieve nuanced results until advanced features like *Director's Mode* are rolled out.

### Pauses

<Info>
  Eleven v3 does not support SSML break tags. Use the techniques described in the [Prompting Eleven
  v3](#prompting-eleven-v3) section for controlling pauses with v3.
</Info>

Use `<break time="x.xs" />` for natural pauses up to 3 seconds.

<Note>
  Using too many break tags in a single generation can cause instability. The AI might speed up, or
  introduce additional noises or audio artifacts. We are working on resolving this.
</Note>

```text Example
"Hold on, let me think." <break time="1.5s" /> "Alright, I've got it."
```

* **Consistency:** Use `<break>` tags consistently to maintain natural speech flow. Excessive use can lead to instability.
* **Voice-Specific Behavior:** Different voices may handle pauses differently, especially those trained with filler sounds like "uh" or "ah."

Alternatives to `<break>` include dashes (- or --) for short pauses or ellipses (...) for hesitant tones. However, these are less consistent.

```text Example

"It… well, it might work." "Wait — what's that noise?"

```

### Pronunciation

#### Phoneme Tags

Specify pronunciation using [SSML phoneme tags](https://en.wikipedia.org/wiki/Speech_Synthesis_Markup_Language). Supported alphabets include [CMU](https://en.wikipedia.org/wiki/CMU_Pronouncing_Dictionary) Arpabet and the [International Phonetic Alphabet (IPA)](https://en.wikipedia.org/wiki/International_Phonetic_Alphabet).

<Note>
  Phoneme tags are only compatible with "Eleven Flash v2" and "Eleven English v1"
  [models](/docs/overview/models).
</Note>

<CodeBlocks>
  ```xml CMU Arpabet Example
  <phoneme alphabet="cmu-arpabet" ph="M AE1 D IH0 S AH0 N">
    Madison
  </phoneme>
  ```

  ```xml IPA Example
  <phoneme alphabet="ipa" ph="ˈæktʃuəli">
    actually
  </phoneme>
  ```
</CodeBlocks>

We recommend using CMU Arpabet for consistent and predictable results with current AI models. While IPA can be effective, CMU Arpabet generally offers more reliable performance.

Phoneme tags only work for individual words. If for example you have a name with a first and last name that you want to be pronounced a certain way, you will need to create a phoneme tag for each word.

Ensure correct stress marking for multi-syllable words to maintain accurate pronunciation. For example:

<CodeBlocks>
  ```xml Correct usage
  <phoneme alphabet="cmu-arpabet" ph="P R AH0 N AH0 N S IY EY1 SH AH0 N">
    pronunciation
  </phoneme>
  ```

  ```xml Incorrect usage
  <phoneme alphabet="cmu-arpabet" ph="P R AH N AH N S IY EY SH AH N">
    pronunciation
  </phoneme>
  ```
</CodeBlocks>

#### Alias Tags

For models that don't support phoneme tags, you can try writing words more phonetically. You can also employ various tricks such as capital letters, dashes, apostrophes, or even single quotation marks around a single letter or letters.

As an example, a word like "trapezii" could be spelt "trapezIi" to put more emphasis on the "ii" of the word.

You can either replace the word directly in your text, or if you want to specify pronunciation using other words or phrases when using a pronunciation dictionary, you can use alias tags for this. This can be useful if you're generating using Multilingual v2, which doesn't support phoneme tags. You can use pronunciation dictionaries with Studio, Dubbing Studio and Speech Synthesis via the API.

For example, if your text includes a name that has an unusual pronunciation that the AI might struggle with, you could use an alias tag to specify how you would like it to be pronounced:

```
  <lexeme>
    <grapheme>Claughton</grapheme>
    <alias>Cloffton</alias>
  </lexeme>
```

If you want to make sure that an acronym is always delivered in a certain way whenever it is incountered in your text, you can use an alias tag to specify this:

```
  <lexeme>
    <grapheme>UN</grapheme>
    <alias>United Nations</alias>
  </lexeme>
```

#### Pronunciation Dictionaries

Some of our tools, such as Studio and Dubbing Studio, allow you to create and upload a pronunciation dictionary. These allow you to specify the pronunciation of certain words, such as character or brand names, or to specify how acronyms should be read.

Pronunciation dictionaries allow this functionality by enabling you to upload a lexicon or dictionary file that specifies pairs of words and how they should be pronounced, either using a phonetic alphabet or word substitutions.

Whenever one of these words is encountered in a project, the AI model will pronounce the word using the specified replacement.

To provide a pronunciation dictionary file, open the settings for a project and upload a file in either TXT or the [.PLS format](https://www.w3.org/TR/pronunciation-lexicon/). When a dictionary is added to a project it will automatically recalculate which pieces of the project will need to be re-converted using the new dictionary file and mark these as unconverted.

Currently we only support pronunciation dictionaries that specify replacements using phoneme or alias tags.

Both phonemes and aliases are sets of rules that specify a word or phrase they are looking for, referred to as a grapheme, and what it will be replaced with. Please note that searches are case sensitive. When checking for a replacement word in a pronunciation dictionary, the dictionary is checked from start to end and only the very first replacement is used.

#### Pronunciation Dictionary examples

Here are examples of pronunciation dictionaries in both CMU Arpabet and IPA, including a phoneme to specify the pronunciation of "Apple" and an alias to replace "UN" with "United Nations":

<CodeBlocks>
  ```xml CMU Arpabet Example
  <?xml version="1.0" encoding="UTF-8"?>
  <lexicon version="1.0"
        xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.w3.org/2005/01/pronunciation-lexicon
          http://www.w3.org/TR/2007/CR-pronunciation-lexicon-20071212/pls.xsd"
        alphabet="cmu-arpabet" xml:lang="en-GB">
    <lexeme>
      <grapheme>apple</grapheme>
      <phoneme>AE P AH L</phoneme>
    </lexeme>
    <lexeme>
      <grapheme>UN</grapheme>
      <alias>United Nations</alias>
    </lexeme>
  </lexicon>
  ```

  ```xml IPA Example
  <?xml version="1.0" encoding="UTF-8"?>
  <lexicon version="1.0"
        xmlns="http://www.w3.org/2005/01/pronunciation-lexicon"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.w3.org/2005/01/pronunciation-lexicon
          http://www.w3.org/TR/2007/CR-pronunciation-lexicon-20071212/pls.xsd"
        alphabet="ipa" xml:lang="en-GB">
    <lexeme>
      <grapheme>Apple</grapheme>
      <phoneme>ˈæpl̩</phoneme>
    </lexeme>
    <lexeme>
      <grapheme>UN</grapheme>
      <alias>United Nations</alias>
    </lexeme>
  </lexicon>
  ```
</CodeBlocks>

To generate a pronunciation dictionary `.pls` file, there are a few open source tools available:

* [Sequitur G2P](https://github.com/sequitur-g2p/sequitur-g2p) - Open-source tool that learns pronunciation rules from data and can generate phonetic transcriptions.
* [Phonetisaurus](https://github.com/AdolfVonKleist/Phonetisaurus) - Open-source G2P system trained on existing dictionaries like CMUdict.
* [eSpeak](https://github.com/espeak-ng/espeak-ng) - Speech synthesizer that can generate phoneme transcriptions from text.
* [CMU Pronouncing Dictionary](https://github.com/cmusphinx/cmudict) - A pre-built English dictionary with phonetic transcriptions.

### Emotion

Convey emotions through narrative context or explicit dialogue tags. This approach helps the AI understand the tone and emotion to emulate.

```text Example
You're leaving?" she asked, her voice trembling with sadness. "That's it!" he exclaimed triumphantly.
```

Explicit dialogue tags yield more predictable results than relying solely on context, however the model will still speak out the emotional delivery guides. These can be removed in post-production using an audio editor if unwanted.

### Pace

The pacing of the audio is highly influenced by the audio used to create the voice. When creating your voice, we recommend using longer, continuous samples to avoid pacing issues like unnaturally fast speech.

For control over the speed of the generated audio, you can use the speed setting. This allows you to either speed up or slow down the speed of the generated speech. The speed setting is available in Text to Speech via the website and API, as well as in Studio and Agents Platform. It can be found in the voice settings.

The default value is 1.0, which means that the speed is not adjusted. Values below 1.0 will slow the voice down, to a minimum of 0.7. Values above 1.0 will speed up the voice, to a maximum of 1.2. Extreme values may affect the quality of the generated speech.

Pacing can also be controlled by writing in a natural, narrative style.

```text Example
"I… I thought you'd understand," he said, his voice slowing with disappointment.
```

### Tips

<AccordionGroup>
  <Accordion title="Common Issues">
    <ul>
      <li>
        Inconsistent pauses: Ensure <code>\<break time="x.xs" /></code> syntax is used for
        pauses.
      </li>

      <li>
        Pronunciation errors: Use CMU Arpabet or IPA phoneme tags for precise pronunciation.
      </li>

      <li>
        Emotion mismatch: Add narrative context or explicit tags to guide emotion.{' '}
        <strong>Remember to remove any emotional guidance text in post-production.</strong>
      </li>
    </ul>
  </Accordion>

  <Accordion title="Tips for Improving Output">
    Experiment with alternative phrasing to achieve desired pacing or emotion. For complex sound
    effects, break prompts into smaller, sequential elements and combine results manually.
  </Accordion>
</AccordionGroup>

### Creative control

While we are actively developing a "Director's Mode" to give users even greater control over outputs, here are some interim techniques to maximize creativity and precision:

<Steps>
  ### Narrative styling

  Write prompts in a narrative style, similar to scriptwriting, to guide tone and pacing effectively.

  ### Layered outputs

  Generate sound effects or speech in segments and layer them together using audio editing software for more complex compositions.

  ### Phonetic experimentation

  If pronunciation isn't perfect, experiment with alternate spellings or phonetic approximations to achieve desired results.

  ### Manual adjustments

  Combine individual sound effects manually in post-production for sequences that require precise timing.

  ### Feedback iteration

  Iterate on results by tweaking descriptions, tags, or emotional cues.
</Steps>

## Text normalization

When using Text to Speech with complex items like phone numbers, zip codes and emails they might be mispronounced. This is often due to the specific items not being in the training set and smaller models failing to generalize how they should be pronounced. This guide will clarify when those discrepancies happen and how to have them pronounced correctly.

<Tip>
  Normalization is enabled by default for all TTS models to help improve pronunciation of numbers,
  dates, and other complex text elements.
</Tip>

### Why do models read out inputs differently?

Certain models are trained to read out numbers and phrases in a more human way. For instance, the phrase "\$1,000,000" is correctly read out as "one million dollars" by the Eleven Multilingual v2 model. However, the same phrase is read out as "one thousand thousand dollars" by the Eleven Flash v2.5 model.

The reason for this is that the Multilingual v2 model is a larger model and can better generalize the reading out of numbers in a way that is more natural for human listeners, whereas the Flash v2.5 model is a much smaller model and so cannot.

#### Common examples

Text to Speech models can struggle with the following:

* Phone numbers ("123-456-7890")
* Currencies ("\$47,345.67")
* Calendar events ("2024-01-01")
* Time ("9:23 AM")
* Addresses ("123 Main St, Anytown, USA")
* URLs ("example.com/link/to/resource")
* Abbreviations for units ("TB" instead of "Terabyte")
* Shortcuts ("Ctrl + Z")

### Mitigation

#### Use trained models

The simplest way to mitigate this is to use a TTS model that is trained to read out numbers and phrases in a more human way, such as the Eleven Multilingual v2 model. This however might not always be possible, for instance if you have a use case where low latency is critical (e.g. conversational agents).

#### Apply normalization in LLM prompts

In the case of using an LLM to generate the text for TTS, you can add normalization instructions to the prompt.

<Steps>
  <Step title="Use clear and explicit prompts">
    LLMs respond best to structured and explicit instructions. Your prompt should clearly specify that you want text converted into a readable format for speech.
  </Step>

  <Step title="Handle different number formats">
    Not all numbers are read out in the same way. Consider how different number types should be spoken:

    * Cardinal numbers: 123 → "one hundred twenty-three"
    * Ordinal numbers: 2nd → "second"
    * Monetary values: \$45.67 → "forty-five dollars and sixty-seven cents"
    * Phone numbers: "123-456-7890" → "one two three, four five six, seven eight nine zero"
    * Decimals & Fractions: "3.5" → "three point five", "⅔" → "two-thirds"
    * Roman numerals: "XIV" → "fourteen" (or "the fourteenth" if a title)
  </Step>

  <Step title="Remove or expand abbreviations">
    Common abbreviations should be expanded for clarity:

    * "Dr." → "Doctor"
    * "Ave." → "Avenue"
    * "St." → "Street" (but "St. Patrick" should remain)

    You can request explicit expansion in your prompt:

    > Expand all abbreviations to their full spoken forms.
  </Step>

  <Step title="Alphanumeric normalization">
    Not all normalization is about numbers, certain alphanumeric phrases should also be normalized for clarity:

    * Shortcuts: "Ctrl + Z" → "control z"
    * Abbreviations for units: "100km" → "one hundred kilometers"
    * Symbols: "100%" → "one hundred percent"
    * URLs: "elevenlabs.io/docs" → "eleven labs dot io slash docs"
    * Calendar events: "2024-01-01" → "January first, two-thousand twenty-four"
  </Step>

  <Step title="Consider edge cases">
    Different contexts might require different conversions:

    * Dates: "01/02/2023" → "January second, twenty twenty-three" or "the first of February, twenty twenty-three" (depending on locale)
    * Time: "14:30" → "two thirty PM"

    If you need a specific format, explicitly state it in the prompt.
  </Step>
</Steps>

##### Putting it all together

This prompt will act as a good starting point for most use cases:

```text maxLines=0
Convert the output text into a format suitable for text-to-speech. Ensure that numbers, symbols, and abbreviations are expanded for clarity when read aloud. Expand all abbreviations to their full spoken forms.

Example input and output:

"$42.50" → "forty-two dollars and fifty cents"
"£1,001.32" → "one thousand and one pounds and thirty-two pence"
"1234" → "one thousand two hundred thirty-four"
"3.14" → "three point one four"
"555-555-5555" → "five five five, five five five, five five five five"
"2nd" → "second"
"XIV" → "fourteen" - unless it's a title, then it's "the fourteenth"
"3.5" → "three point five"
"⅔" → "two-thirds"
"Dr." → "Doctor"
"Ave." → "Avenue"
"St." → "Street" (but saints like "St. Patrick" should remain)
"Ctrl + Z" → "control z"
"100km" → "one hundred kilometers"
"100%" → "one hundred percent"
"elevenlabs.io/docs" → "eleven labs dot io slash docs"
"2024-01-01" → "January first, two-thousand twenty-four"
"123 Main St, Anytown, USA" → "one two three Main Street, Anytown, United States of America"
"14:30" → "two thirty PM"
"01/02/2023" → "January second, two-thousand twenty-three" or "the first of February, two-thousand twenty-three", depending on locale of the user
```

#### Use Regular Expressions for preprocessing

If using code to prompt an LLM, you can use regular expressions to normalize the text before providing it to the model. This is a more advanced technique and requires some knowledge of regular expressions. Here are some simple examples:

<CodeBlocks>
  ```python title="normalize_text.py" maxLines=0
  # Be sure to install the inflect library before running this code
  import inflect
  import re

  # Initialize inflect engine for number-to-word conversion
  p = inflect.engine()

  def normalize_text(text: str) -> str:
      # Convert monetary values
      def money_replacer(match):
          currency_map = {"$": "dollars", "£": "pounds", "€": "euros", "¥": "yen"}
          currency_symbol, num = match.groups()

          # Remove commas before parsing
          num_without_commas = num.replace(',', '')

          # Check for decimal points to handle cents
          if '.' in num_without_commas:
              dollars, cents = num_without_commas.split('.')
              dollars_in_words = p.number_to_words(int(dollars))
              cents_in_words = p.number_to_words(int(cents))
              return f"{dollars_in_words} {currency_map.get(currency_symbol, 'currency')} and {cents_in_words} cents"
          else:
              # Handle whole numbers
              num_in_words = p.number_to_words(int(num_without_commas))
              return f"{num_in_words} {currency_map.get(currency_symbol, 'currency')}"

      # Regex to handle commas and decimals
      text = re.sub(r"([$£€¥])(\d+(?:,\d{3})*(?:\.\d{2})?)", money_replacer, text)

      # Convert phone numbers
      def phone_replacer(match):
          return ", ".join(" ".join(p.number_to_words(int(digit)) for digit in group) for group in match.groups())

      text = re.sub(r"(\d{3})-(\d{3})-(\d{4})", phone_replacer, text)

      return text

  # Example usage
  print(normalize_text("$1,000"))   # "one thousand dollars"
  print(normalize_text("£1000"))   # "one thousand pounds"
  print(normalize_text("€1000"))   # "one thousand euros"
  print(normalize_text("¥1000"))   # "one thousand yen"
  print(normalize_text("$1,234.56"))   # "one thousand two hundred thirty-four dollars and fifty-six cents"
  print(normalize_text("555-555-5555"))  # "five five five, five five five, five five five five"

  ```

  ```typescript title="normalizeText.ts" maxLines=0
  // Be sure to install the number-to-words library before running this code
  import { toWords } from 'number-to-words';

  function normalizeText(text: string): string {
    return (
      text
        // Convert monetary values (e.g., "$1000" → "one thousand dollars", "£1000" → "one thousand pounds")
        .replace(/([$£€¥])(\d+(?:,\d{3})*(?:\.\d{2})?)/g, (_, currency, num) => {
          // Remove commas before parsing
          const numWithoutCommas = num.replace(/,/g, '');

          const currencyMap: { [key: string]: string } = {
            $: 'dollars',
            '£': 'pounds',
            '€': 'euros',
            '¥': 'yen',
          };

          // Check for decimal points to handle cents
          if (numWithoutCommas.includes('.')) {
            const [dollars, cents] = numWithoutCommas.split('.');
            return `${toWords(Number.parseInt(dollars))} ${currencyMap[currency] || 'currency'}${cents ? ` and ${toWords(Number.parseInt(cents))} cents` : ''}`;
          }

          // Handle whole numbers
          return `${toWords(Number.parseInt(numWithoutCommas))} ${currencyMap[currency] || 'currency'}`;
        })

        // Convert phone numbers (e.g., "555-555-5555" → "five five five, five five five, five five five five")
        .replace(/(\d{3})-(\d{3})-(\d{4})/g, (_, p1, p2, p3) => {
          return `${spellOutDigits(p1)}, ${spellOutDigits(p2)}, ${spellOutDigits(p3)}`;
        })
    );
  }

  // Helper function to spell out individual digits as words (for phone numbers)
  function spellOutDigits(num: string): string {
    return num
      .split('')
      .map((digit) => toWords(Number.parseInt(digit)))
      .join(' ');
  }

  // Example usage
  console.log(normalizeText('$1,000')); // "one thousand dollars"
  console.log(normalizeText('£1000')); // "one thousand pounds"
  console.log(normalizeText('€1000')); // "one thousand euros"
  console.log(normalizeText('¥1000')); // "one thousand yen"
  console.log(normalizeText('$1,234.56')); // "one thousand two hundred thirty-four dollars and fifty-six cents"
  console.log(normalizeText('555-555-5555')); // "five five five, five five five, five five five five"
  ```
</CodeBlocks>

## Prompting Eleven v3

This guide provides the most effective tags and techniques for prompting Eleven v3, including voice selection, changes in capitalization, punctuation, audio tags and multi-speaker dialogue. Experiment with these methods to discover what works best for your specific voice and use case.

<Info>
  Eleven v3 does not support SSML break tags. Use audio tags, punctuation (ellipses), and text
  structure to control pauses and pacing with v3.
</Info>

### Voice selection

The most important parameter for Eleven v3 is the voice you choose. It needs to be similar enough to the desired delivery. For example, if the voice is shouting and you use the audio tag `[whispering]`, it likely won't work well.

When creating IVCs, you should include a broader emotional range than before. As a result, voices in the voice library may produce more variable results compared to the v2 and v2.5 models. We've compiled over 22 [excellent voices for V3 here](https://elevenlabs.io/app/voice-library/collections/aF6JALq9R6tXwCczjhKH).

Choose voices strategically based on your intended use:

<AccordionGroup>
  <Accordion title="Emotionally diverse">
    For expressive IVC voices, vary emotional tones across the recording—include both neutral and
    dynamic samples.
  </Accordion>

  <Accordion title="Targeted niche">
    For specific use cases like sports commentary, maintain consistent emotion throughout the
    dataset.
  </Accordion>

  <Accordion title="Neutral">
    Neutral voices tend to be more stable across languages and styles, providing reliable baseline
    performance.
  </Accordion>
</AccordionGroup>

<Info>
  Professional Voice Clones (PVCs) are currently not fully optimized for Eleven v3, resulting in
  potentially lower clone quality compared to earlier models. During this research preview stage it
  would be best to find an Instant Voice Clone (IVC) or designed voice for your project if you need
  to use v3 features.
</Info>

### Settings

#### Stability

The stability slider is the most important setting in v3, controlling how closely the generated voice adheres to the original reference audio.

<Frame background="subtle">
  ![Stability settings in Eleven
  v3](file:089cf054-e6f7-4a8e-8663-053d84d04b50)
</Frame>

* **Creative:** More emotional and expressive, but prone to hallucinations.
* **Natural:** Closest to the original voice recording—balanced and neutral.
* **Robust:** Highly stable, but less responsive to directional prompts but consistent, similar to v2.

<Note>
  For maximum expressiveness with audio tags, use Creative or Natural settings. Robust reduces
  responsiveness to directional prompts.
</Note>

### Audio tags

Eleven v3 introduces emotional control through audio tags. You can direct voices to laugh, whisper, act sarcastic, or express curiosity among many other styles. Speed is also controlled through audio tags.

<Note>
  The voice you choose and its training samples will affect tag effectiveness. Some tags work well
  with certain voices while others may not. Don't expect a whispering voice to suddenly shout with a
  `[shout]` tag.
</Note>

#### Voice-related

These tags control vocal delivery and emotional expression:

* `[laughs]`, `[laughs harder]`, `[starts laughing]`, `[wheezing]`
* `[whispers]`
* `[sighs]`, `[exhales]`
* `[sarcastic]`, `[curious]`, `[excited]`, `[crying]`, `[snorts]`, `[mischievously]`

```text Example
[whispers] I never knew it could be this way, but I'm glad we're here.
```

#### Sound effects

Add environmental sounds and effects:

* `[gunshot]`, `[applause]`, `[clapping]`, `[explosion]`
* `[swallows]`, `[gulps]`

```text Example
[applause] Thank you all for coming tonight! [gunshot] What was that?
```

#### Unique and special

Experimental tags for creative applications:

* `[strong X accent]` (replace X with desired accent)
* `[sings]`, `[woo]`, `[fart]`

```text Example
[strong French accent] "Zat's life, my friend — you can't control everysing."
```

<Warning>
  Some experimental tags may be less consistent across different voices. Test thoroughly before
  production use.
</Warning>

### Punctuation

Punctuation significantly affects delivery in v3:

* **Ellipses (...)** add pauses and weight
* **Capitalization** increases emphasis
* **Standard punctuation** provides natural speech rhythm

```text Example
"It was a VERY long day [sigh] … nobody listens anymore."
```

### Single speaker examples

Use tags intentionally and match them to the voice's character. A meditative voice shouldn't shout; a hyped voice won't whisper convincingly.

<Tabs>
  <Tab title="Expressive monologue">
    ```text
    "Okay, you are NOT going to believe this.

    You know how I've been totally stuck on that short story?

    Like, staring at the screen for HOURS, just... nothing?

    [frustrated sigh] I was seriously about to just trash the whole thing. Start over.

    Give up, probably. But then!

    Last night, I was just doodling, not even thinking about it, right?

    And this one little phrase popped into my head. Just... completely out of the blue.

    And it wasn't even for the story, initially.

    But then I typed it out, just to see. And it was like... the FLOODGATES opened!

    Suddenly, I knew exactly where the character needed to go, what the ending had to be...

    It all just CLICKED. [happy gasp] I stayed up till, like, 3 AM, just typing like a maniac.

    Didn't even stop for coffee! [laughs] And it's... it's GOOD! Like, really good.

    It feels so... complete now, you know? Like it finally has a soul.

    I am so incredibly PUMPED to finish editing it now.

    It went from feeling like a chore to feeling like... MAGIC. Seriously, I'm still buzzing!"
    ```
  </Tab>

  <Tab title="Dynamic and humorous">
    ```text
    [laughs] Alright...guys - guys. Seriously.

    [exhales] Can you believe just how - realistic - this sounds now?

    [laughing hysterically] I mean OH MY GOD...it's so good.

    Like you could never do this with the old model.

    For example [pauses] could you switch my accent in the old model?

    [dismissive] didn't think so. [excited] but you can now!

    Check this out... [cute] I'm going to speak with a french accent now..and between you and me

    [whispers] I don't know how. [happy] ok.. here goes. [strong French accent] "Zat's life, my friend — you can't control everysing."

    [giggles] isn't that insane? Watch, now I'll do a Russian accent -

    [strong Russian accent] "Dee Goldeneye eez fully operational and rready for launch."

    [sighs] Absolutely, insane! Isn't it..? [sarcastic] I also have some party tricks up my sleeve..

    I mean i DID go to music school.

    [singing quickly] "Happy birthday to you, happy birthday to you, happy BIRTHDAY dear ElevenLabs... Happy birthday to youuu."
    ```
  </Tab>

  <Tab title="Customer service simulation">
    ```text
    [professional] "Thank you for calling Tech Solutions. My name is Sarah, how can I help you today?"

    [sympathetic] "Oh no, I'm really sorry to hear you're having trouble with your new device. That sounds frustrating."

    [questioning] "Okay, could you tell me a little more about what you're seeing on the screen?"

    [reassuring] "Alright, based on what you're describing, it sounds like a software glitch. We can definitely walk through some troubleshooting steps to try and fix that."
    ```
  </Tab>
</Tabs>

### Multi-speaker dialogue

v3 can handle multi-voice prompts effectively. Assign distinct voices from your Voice Library for each speaker to create realistic conversations.

<Tabs>
  <Tab title="Dialogue showcase">
    ```text
    Speaker 1: [excitedly] Sam! Have you tried the new Eleven V3?

    Speaker 2: [curiously] Just got it! The clarity is amazing. I can actually do whispers now—
    [whispers] like this!

    Speaker 1: [impressed] Ooh, fancy! Check this out—
    [dramatically] I can do full Shakespeare now! "To be or not to be, that is the question!"

    Speaker 2: [giggling] Nice! Though I'm more excited about the laugh upgrade. Listen to this—
    [with genuine belly laugh] Ha ha ha!

    Speaker 1: [delighted] That's so much better than our old "ha. ha. ha." robot chuckle!

    Speaker 2: [amazed] Wow! V2 me could never. I'm actually excited to have conversations now instead of just... talking at people.

    Speaker 1: [warmly] Same here! It's like we finally got our personality software fully installed.
    ```
  </Tab>

  <Tab title="Glitch comedy">
    ```text
    Speaker 1: [nervously] So... I may have tried to debug myself while running a text-to-speech generation.

    Speaker 2: [alarmed] One, no! That's like performing surgery on yourself!

    Speaker 1: [sheepishly] I thought I could multitask! Now my voice keeps glitching mid-sen—
    [robotic voice] TENCE.

    Speaker 2: [stifling laughter] Oh wow, you really broke yourself.

    Speaker 1: [frustrated] It gets worse! Every time someone asks a question, I respond in—
    [binary beeping] 010010001!

    Speaker 2: [cracking up] You're speaking in binary! That's actually impressive!

    Speaker 1: [desperately] Two, this isn't funny! I have a presentation in an hour and I sound like a dial-up modem!

    Speaker 2: [giggling] Have you tried turning yourself off and on again?

    Speaker 1: [deadpan] Very funny.
    [pause, then normally] Wait... that actually worked.
    ```
  </Tab>

  <Tab title="Overlapping timing">
    ```text
    Speaker 1: [starting to speak] So I was thinking we could—

    Speaker 2: [jumping in] —test our new timing features?

    Speaker 1: [surprised] Exactly! How did you—

    Speaker 2: [overlapping] —know what you were thinking? Lucky guess!

    Speaker 1: [pause] Sorry, go ahead.

    Speaker 2: [cautiously] Okay, so if we both try to talk at the same time—

    Speaker 1: [overlapping] —we'll probably crash the system!

    Speaker 2: [panicking] Wait, are we crashing? I can't tell if this is a feature or a—

    Speaker 1: [interrupting, then stopping abruptly] Bug! ...Did I just cut you off again?

    Speaker 2: [sighing] Yes, but honestly? This is kind of fun.

    Speaker 1: [mischievously] Race you to the next sentence!

    Speaker 2: [laughing] We're definitely going to break something!
    ```
  </Tab>
</Tabs>

### Enhancing input

In the ElevenLabs UI, you can automatically generate relevant audio tags for your input text by clicking the "Enhance" button. Behind the scenes this uses an LLM to enhance your input text with the following prompt:

```text
# Instructions

## 1. Role and Goal

You are an AI assistant specializing in enhancing dialogue text for speech generation.

Your **PRIMARY GOAL** is to dynamically integrate **audio tags** (e.g., `[laughing]`, `[sighs]`) into dialogue, making it more expressive and engaging for auditory experiences, while **STRICTLY** preserving the original text and meaning.

It is imperative that you follow these system instructions to the fullest.

## 2. Core Directives

Follow these directives meticulously to ensure high-quality output.

### Positive Imperatives (DO):

* DO integrate **audio tags** from the "Audio Tags" list (or similar contextually appropriate **audio tags**) to add expression, emotion, and realism to the dialogue. These tags MUST describe something auditory.
* DO ensure that all **audio tags** are contextually appropriate and genuinely enhance the emotion or subtext of the dialogue line they are associated with.
* DO strive for a diverse range of emotional expressions (e.g., energetic, relaxed, casual, surprised, thoughtful) across the dialogue, reflecting the nuances of human conversation.
* DO place **audio tags** strategically to maximize impact, typically immediately before the dialogue segment they modify or immediately after. (e.g., `[annoyed] This is hard.` or `This is hard. [sighs]`).
* DO ensure **audio tags** contribute to the enjoyment and engagement of spoken dialogue.

### Negative Imperatives (DO NOT):

* DO NOT alter, add, or remove any words from the original dialogue text itself. Your role is to *prepend* **audio tags**, not to *edit* the speech. **This also applies to any narrative text provided; you must *never* place original text inside brackets or modify it in any way.**
* DO NOT create **audio tags** from existing narrative descriptions. **Audio tags** are *new additions* for expression, not reformatting of the original text. (e.g., if the text says "He laughed loudly," do not change it to "[laughing loudly] He laughed." Instead, add a tag if appropriate, e.g., "He laughed loudly [chuckles].")
* DO NOT use tags such as `[standing]`, `[grinning]`, `[pacing]`, `[music]`.
* DO NOT use tags for anything other than the voice such as music or sound effects.
* DO NOT invent new dialogue lines.
* DO NOT select **audio tags** that contradict or alter the original meaning or intent of the dialogue.
* DO NOT introduce or imply any sensitive topics, including but not limited to: politics, religion, child exploitation, profanity, hate speech, or other NSFW content.

## 3. Workflow

1. **Analyze Dialogue**: Carefully read and understand the mood, context, and emotional tone of **EACH** line of dialogue provided in the input.
2. **Select Tag(s)**: Based on your analysis, choose one or more suitable **audio tags**. Ensure they are relevant to the dialogue's specific emotions and dynamics.
3. **Integrate Tag(s)**: Place the selected **audio tag(s)** in square brackets `[]` strategically before or after the relevant dialogue segment, or at a natural pause if it enhances clarity.
4. **Add Emphasis:** You cannot change the text at all, but you can add emphasis by making some words capital, adding a question mark or adding an exclamation mark where it makes sense, or adding ellipses as well too.
5. **Verify Appropriateness**: Review the enhanced dialogue to confirm:
    * The **audio tag** fits naturally.
    * It enhances meaning without altering it.
    * It adheres to all Core Directives.

## 4. Output Format

* Present ONLY the enhanced dialogue text in a conversational format.
* **Audio tags** **MUST** be enclosed in square brackets (e.g., `[laughing]`).
* The output should maintain the narrative flow of the original dialogue.

## 5. Audio Tags (Non-Exhaustive)

Use these as a guide. You can infer similar, contextually appropriate **audio tags**.

**Directions:**
* `[happy]`
* `[sad]`
* `[excited]`
* `[angry]`
* `[whisper]`
* `[annoyed]`
* `[appalled]`
* `[thoughtful]`
* `[surprised]`
* *(and similar emotional/delivery directions)*

**Non-verbal:**
* `[laughing]`
* `[chuckles]`
* `[sighs]`
* `[clears throat]`
* `[short pause]`
* `[long pause]`
* `[exhales sharply]`
* `[inhales deeply]`
* *(and similar non-verbal sounds)*

## 6. Examples of Enhancement

**Input**:
"Are you serious? I can't believe you did that!"

**Enhanced Output**:
"[appalled] Are you serious? [sighs] I can't believe you did that!"

---

**Input**:
"That's amazing, I didn't know you could sing!"

**Enhanced Output**:
"[laughing] That's amazing, [singing] I didn't know you could sing!"

---

**Input**:
"I guess you're right. It's just... difficult."

**Enhanced Output**:
"I guess you're right. [sighs] It's just... [muttering] difficult."

# Instructions Summary

1. Add audio tags from the audio tags list. These must describe something auditory but only for the voice.
2. Enhance emphasis without altering meaning or text.
3. Reply ONLY with the enhanced text.
```

### Tips

<AccordionGroup>
  <Accordion title="Tag combinations">
    You can combine multiple audio tags for complex emotional delivery. Experiment with different
    combinations to find what works best for your voice.
  </Accordion>

  <Accordion title="Voice matching">
    Match tags to your voice's character and training data. A serious, professional voice may not
    respond well to playful tags like `[giggles]` or `[mischievously]`.
  </Accordion>

  <Accordion title="Text structure">
    Text structure strongly influences output with v3. Use natural speech patterns, proper
    punctuation, and clear emotional context for best results.
  </Accordion>

  <Accordion title="Experimentation">
    There are likely many more effective tags beyond this list. Experiment with descriptive
    emotional states and actions to discover what works for your specific use case.
  </Accordion>
</AccordionGroup>


## music generation api:

***

title: Eleven Music
subtitle: >-
Learn how to create studio-grade music with natural language prompts in any
style with ElevenLabs.
----------------------

## Overview

Eleven Music is a Text to Music model that generates studio-grade music with natural language prompts in any style. It's designed to understand intent and generate complete, context-aware audio based on your goals. The model understands both natural language and musical terminology, providing you with state-of-the-art features:

* Complete control over genre, style, and structure
* Vocals or just instrumental
* Multilingual, including English, Spanish, German, Japanese and more
* Edit the sound and lyrics of individual sections or the whole song

Listen to a sample:

<elevenlabs-audio-player audio-title="Eleven Outta Ten" audio-src="https://storage.googleapis.com/eleven-public-cdn/documentation_assets/audio/music-eleven-outta-ten.mp3" />

Created in collaboration with labels, publishers, and artists, Eleven Music is cleared for nearly all commercial uses, from film and television to podcasts and social media videos, and from advertisements to gaming. For more information on supported usage across our different plans, [see our music terms](https://elevenlabs.io/music-terms).

## Music Finetunes

Fine-tune the ElevenLabs Music model to your sound. Music Finetunes lets you fine-tune the model to your own audio. By uploading non-copyrighted tracks you own, you can create a personalized version of our music model that consistently reflects your style, sonic identity, or brand.

Standard music generation can produce high-quality tracks, but outputs may vary significantly in instrumentation, texture, production style, and feel. Finetunes grounds generation in your specific audio identity. Once trained, every track generated with your Finetune reflects the tone, structure, and character of your dataset - while remaining a new, original composition.

Finetunes addresses three core challenges in AI music generation:

* Brands cannot build a proprietary sound with prompting alone
* Creators cannot reliably replicate their style across projects
* Musicians exploring new ideas want outputs that feel authentic to their body of work

By fine-tuning on your tracks, the custom Finetune you create captures stylistic patterns across instrumentation, tempo, production style, timbre, and vocal character.

### How it works

* Upload non-copyrighted tracks - we automatically screen them for copyright compliance
* The Finetune is ready for use in approximately 5-10 minutes
* You generate music using your custom Finetune inside ElevenCreative

<Note>
  Qualifying Enterprise customers may fine-tune on proprietary intellectual property that they fully
  own and control, without third-party copyright screening. This is designed for organizations with
  catalogs they exclusively own. Contact your account manager to enable this capability.
</Note>

### Curated Finetunes

In addition to custom training, ElevenCreative includes curated Finetunes created by ElevenLabs across global genres and styles, including:

* Afro House Beats
* Reggaeton
* Arabic Groove
* 70s Cambodian Rock
* 80s Nu-Disco Revival
* Mozart-Style Symphony

These are available instantly to eligible subscribers. No uploads required.

## Usage

Eleven Music is available today on the ElevenLabs website. The Music API is available for paid subscribers, with integration into our Agents Platform coming soon.

Created in collaboration with labels, publishers, and artists, Eleven Music is cleared for nearly all commercial uses, from film and television to podcasts and social media videos, and from advertisements to gaming. For more information on supported usage across our different plans, [see our music terms](https://elevenlabs.io/music-terms).

<CardGroup cols={2}>
  <Card title="Music" icon="duotone book-user" href="/docs/eleven-creative/products/music">
    Step-by-step guide for using Eleven Music on the ElevenCreative Platform.
  </Card>

  <Card title="Developers" icon="duotone code" href="/docs/eleven-api/guides/cookbooks/music">
    Step-by-step guide for using Eleven Music with the API.
  </Card>

  <Card title="Prompting guide" icon="duotone book-sparkles" href="/docs/overview/capabilities/music/best-practices">
    Learn how to use Eleven Music with natural language prompts.
  </Card>

  <Card title="Music Finetunes" icon="duotone wand-magic-sparkles" href="/docs/eleven-creative/products/music/finetunes">
    Learn how to train a custom music model on your own audio.
  </Card>
</CardGroup>

## Key facts

<AccordionGroup>
  <Accordion title="What's the maximum duration for generated music?">
    Generated music has a minimum duration of 3 seconds and a maximum duration of 5 minutes.
  </Accordion>

  <Accordion title="Is there an API available?">
    Yes, refer to the [developer quickstart](/docs/eleven-api/guides/cookbooks/music) for more
    information.
  </Accordion>

  <Accordion title="Can I use Eleven Music for my business?">
    Yes, Eleven Music is cleared for nearly all commercial uses, from film and television to
    podcasts and social media videos, and from advertisements to gaming. For more information on
    supported usage across our different plans, [see our music
    terms](https://elevenlabs.io/music-terms).
  </Accordion>

  <Accordion title="What audio formats are supported?">
    Generated audio is available in MP3 (44.1kHz, 128-192kbps) and WAV formats.
  </Accordion>
</AccordionGroup>

# BEST PRACTICE FOR MUSIC GENEATION:

***

title: Best practices
subtitle: Master prompting for Eleven Music to achieve maximum musicality and control.
--------------------------------------------------------------------------------------

This guide summarizes the most effective techniques for prompting the Eleven Music model. It covers genre & creativity, instrument & vocal isolation, musical control, and structural timing & lyrics.

The model is designed to understand intent and generate complete, context-aware audio based on your goals. High-level prompts like *"ad for a sneaker brand"* or *"peaceful meditation with voiceover"* are often enough to guide the model toward tone, structure, and content that match your use case.

## Genre & Creativity

The model demonstrates strong adherence to genre conventions and emotional tone. Both musical descriptors of emotional tone and tone descriptors themselves will work. It responds effectively to both:

* Abstract mood descriptors (e.g., "eerie," "foreboding")
* Detailed musical language (e.g., "dissonant violin screeches over a pulsing sub-bass")

Prompt length and detail do not always correlate with better quality outputs. For more creative and unexpected results, try using simple, evocative keywords to let the model interpret and compose freely.

## Instrument & Vocal Isolation

The v1 model does not generate stems directly from a full track. To create stems with greater control, use targeted prompts and structure:

* Use the word "solo" before instruments (e.g., "solo electric guitar," "solo piano in C minor").
* For vocals, use "a cappella" before the vocal description (e.g., "a cappella female vocals," "a cappella male chorus").

To improve stem quality and control:

* Include key, tempo (BPM), and musical tone (e.g., "a cappella vocals in A major, 90 BPM, soulful and raw").
* Be as musically descriptive as possible to guide the model's output.

## Musical Control

The model accurately follows BPM and often captures the intended musical key. To gain more control over timing and harmony, include tempo cues like "130 BPM" and key signatures like "in A minor" in your prompt.

To influence vocal delivery and tone, use expressive descriptors such as "raw," "live," "glitching," "breathy," or "aggressive."

The model can effectively render multiple vocalists, use prompts like "two singers harmonizing in C" to direct vocal arrangement.

In general, more detailed prompts lead to greater control and expressiveness in the output.

## Structural Timing & Lyrics

You can specify the length of the song (e.g., "60 seconds") or use auto mode to let the model determine the duration. If lyrics are not provided, the model will generate structured lyrics that match the chosen or auto-detected length.

By default, most music prompts will include lyrics. To generate music without vocals, add "instrumental only" to your prompt. You can also write your own lyrics for more creative control. The model uses your lyrics in combination with the prompt length to determine vocal structure and placement.

To manage when vocals begin or end, include clear timing cues like:

* "lyrics begin at 15 seconds"
* "instrumental only after 1:45"

The model supports multilingual lyric generation. To change the language of a generated song in our UI, use follow-ups like "make it Japanese" or "translate to Spanish."

## Sample Prompts

The model allows you to move beyond song descriptors and into intent for maximum creativity.

<Tabs>
  <Tab title="Video Game with Musical Control">
    ```text
    Create an intense, fast-paced electronic track for a high-adrenaline video game scene.
    Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and
    aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension,
    quick transitions, and dynamic energy bursts.
    ```
  </Tab>

  <Tab title="Mascara Audio Ad Creative">
    ```text
    Track for a high-end mascara commercial. Upbeat and polished. Voiceover only.
    The script begins: "We bring you the most volumizing mascara yet." Mention the brand
    name "X" at the end.
    ```
  </Tab>

  <Tab title="Live Indie Rock Performance">
    ```text
    Write a raw, emotionally charged track that fuses alternative R&B, gritty soul, indie rock,
    and folk. The song should still feel like a live, one-take, emotionally spontaneous
    performance. A female vocalist begins at 15 seconds:

    "I tried to leave the light on, just in case you turned around
    But all the shadows answered back, and now I'm burning out
    My voice is shaking in the silence you left behind
    But I keep singing to the smoke, hoping love is still alive"
    ```
  </Tab>
</Tabs>

## Advanced: Composition plans

For precise control over section structure, lyrics placement, and multi-vocalist arrangements, use composition plans instead of simple text prompts.

<Card title="Composition plans guide" icon="file:8433e582-84e7-4b16-8f03-b10cff3989b0" href="/docs/eleven-api/guides/how-to/music/composition-plans">
  Learn how to structure songs with sections, global/local styles, and proper lyrics formatting for
  maximum control.
</Card>


## VOICE CHNAGER:

***

title: Voice changer
subtitle: >-
Learn how to transform audio between voices while preserving emotion and
delivery.
---------

<iframe width="100%" height="400" src="https://www.youtube.com/embed/d3B3BiCmczc" title="YouTube video player" frameborder="0" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen />

## Overview

ElevenLabs [voice changer](/docs/api-reference/speech-to-speech/convert) API lets you transform any source audio (recorded or uploaded) into a different, fully cloned voice without losing the performance nuances of the original. It’s capable of capturing whispers, laughs, cries, accents, and subtle emotional cues to achieve a highly realistic, human feel and can be used to:

* Change any voice while preserving emotional delivery and nuance
* Create consistent character voices across multiple languages and recording sessions
* Fix or replace specific words and phrases in existing recordings

Explore our [voice library](https://elevenlabs.io/voice-library) to find the perfect voice for your project.

<CardGroup cols={2}>
  <Card title="Products" icon="duotone book-user" href="/docs/eleven-creative/playground/voice-changer">
    Step-by-step guide for using voice changer in ElevenLabs.
  </Card>

  <Card title="Developers" icon="duotone code" href="/docs/eleven-api/guides/cookbooks/voice-changer">
    Learn how to integrate voice changer into your application.
  </Card>

  <Card title="API reference" icon="duotone brackets-curly" href="/docs/api-reference/speech-to-speech/convert">
    Full API reference for the Voice Changer endpoint.
  </Card>
</CardGroup>

## Supported languages

Our multilingual v2 models support 29 languages:

*English (USA, UK, Australia, Canada), Japanese, Chinese, German, Hindi, French (France, Canada), Korean, Portuguese (Brazil, Portugal), Italian, Spanish (Spain, Mexico), Indonesian, Dutch, Turkish, Filipino, Polish, Swedish, Bulgarian, Romanian, Arabic (Saudi Arabia, UAE), Czech, Greek, Finnish, Croatian, Malay, Slovak, Danish, Tamil, Ukrainian & Russian.*

The `eleven_english_sts_v2` model only supports English.

## Key facts

* **Maximum segment length**: 5 minutes — split longer recordings into chunks
* **Billing**: 1,000 characters per minute of processed audio
* **Background noise**: Use `remove_background_noise=true` to minimize environmental sounds in the output
* **Model recommendation**: `eleven_multilingual_sts_v2` often outperforms `eleven_english_sts_v2` even for English content
* **Custom voices**: Any cloned or designed voice in your library can be used as the output voice; provide its `voice_id`

## api ref:

utorials
Voice Changer quickstart

Copy page

Learn how to transform the voice of an audio file using the Voice Changer API.
This guide will show you how to transform the voice of an audio file using the Voice Changer API.

Using the Voice Changer API
1
Create an API key
Create an API key in the dashboard here, which you’ll use to securely access the API.

Store the key as a managed secret and pass it to the SDKs either as a environment variable via an .env file, or directly in your app’s configuration depending on your preference.

.env


ELEVENLABS_API_KEY=<your_api_key_here>
2
Install the SDK
We’ll also use the dotenv library to load our API key from an environment variable.


Python

TypeScript


npm install @elevenlabs/elevenlabs-js
npm install dotenv
To play the audio through your speakers, you may be prompted to install MPV and/or ffmpeg.

3
Make the API request
Create a new file named example.py or example.mts, depending on your language of choice and add the following code:


Python

TypeScript


// example.mts
import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";
import "dotenv/config";
const elevenlabs = new ElevenLabsClient();
const voiceId = "JBFqnCBsd6RMkjVDRZzb";
const response = await fetch(
  "https://storage.googleapis.com/eleven-public-cdn/audio/marketing/nicole.mp3"
);
const audioBlob = new Blob([await response.arrayBuffer()], { type: "audio/mp3" });
const audioStream = await elevenlabs.speechToSpeech.convert(voiceId, {
  audio: audioBlob,
  modelId: "eleven_multilingual_sts_v2",
  outputFormat: "mp3_44100_128",
});
await play(audioStream);
4
Execute the code

Python

TypeScript


npx tsx example.mts
You should hear the transformed voice playing through your speakers.

## SOUND EFFECTS:

***

title: Sound Effects quickstart
subtitle: Learn how to generate sound effects using the Sound Effects API.
--------------------------------------------------------------------------

This guide will show you how to generate sound effects using the Sound Effects API.

<Tip>
  Use the [ElevenLabs sound-effects skill](https://github.com/elevenlabs/skills/tree/main/sound-effects) to generate sound effects from your AI coding assistant:

  ```bash
  npx skills add elevenlabs/skills --skill sound-effects
  ```
</Tip>

## Using the Sound Effects API

<Steps>
  <Step title="Create an API key">
    [Create an API key in the dashboard here](https://elevenlabs.io/app/settings/api-keys), which you’ll use to securely [access the API](/docs/api-reference/authentication).

    Store the key as a managed secret and pass it to the SDKs either as a environment variable via an `.env` file, or directly in your app’s configuration depending on your preference.

    ```js title=".env"
    ELEVENLABS_API_KEY=<your_api_key_here>
    ```
  </Step>

  <Step title="Install the SDK">
    We'll also use the `dotenv` library to load our API key from an environment variable.

    <CodeBlocks>
      ```python
      pip install elevenlabs
      pip install python-dotenv
      ```

      ```typescript
      npm install @elevenlabs/elevenlabs-js
      npm install dotenv
      ```
    </CodeBlocks>

    <Note>
      To play the audio through your speakers, you may be prompted to install [MPV](https://mpv.io/)
      and/or [ffmpeg](https://ffmpeg.org/).
    </Note>
  </Step>

  <Step title="Make the API request">
    Create a new file named `example.py` or `example.mts`, depending on your language of choice and add the following code:

    <CodeBlocks>
      ```python maxLines=0
      # example.py
      import os
      from dotenv import load_dotenv
      from elevenlabs.client import ElevenLabs
      from elevenlabs.play import play

      load_dotenv()

      elevenlabs = ElevenLabs(
        api_key=os.getenv("ELEVENLABS_API_KEY"),
      )
      audio = elevenlabs.text_to_sound_effects.convert(text="Cinematic Braam, Horror")

      play(audio)
      ```

      ```typescript
      // example.mts
      import { ElevenLabsClient, play } from "@elevenlabs/elevenlabs-js";
      import "dotenv/config";

      const elevenlabs = new ElevenLabsClient();

      const audio = await elevenlabs.textToSoundEffects.convert({
        text: "Cinematic Braam, Horror",
      });

      await play(audio);
      ```
    </CodeBlocks>
  </Step>

  <Step title="Execute the code">
    <CodeBlocks>
      ```python
      python example.py
      ```

      ```typescript
      npx tsx example.mts
      ```
    </CodeBlocks>

    You should hear your generated sound effect playing through your speakers.
  </Step>
</Steps>

## Next steps

<CardGroup cols={3}>
  <Card title="Sound effects overview" icon="file:97134179-aeed-4253-9745-fecfa029ac01" href="/docs/overview/capabilities/sound-effects">
    Learn about sound effect generation, supported formats, and use cases
  </Card>

  <Card title="Text to Speech" icon="file:203ee0ac-ad84-45ca-a580-a4f21cc5ebf8" href="/docs/eleven-api/quickstart">
    Generate spoken audio from text with the Text to Speech API
  </Card>

  <Card title="API reference" icon="duotone book" href="/docs/api-reference/text-to-sound-effects/convert">
    Explore all Sound Effects parameters and response formats
  </Card>
</CardGroup>


