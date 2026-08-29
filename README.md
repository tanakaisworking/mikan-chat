# mikan chat

**mikan chat** is a free and open-source local AI character chat app for
Windows and macOS.

The goal is to make locally-running character chat approachable: choose or
import a character pack, talk by text or voice, and keep the conversation on
your own computer.

> This project is at the concept and early-development stage. There is no
> downloadable build yet.

## Project goals

- Run character conversations with a local LLM.
- Accept voice input through Whisper-compatible speech recognition.
- Return spoken responses through Irodori TTS.
- Import community-created character and scenario packs for free.
- Keep chat history and inference data local by default.
- Support Windows and macOS without requiring local AI expertise.
- Publish an open, documented pack format that other tools can implement.

## Initial scope

The first usable version will focus on:

- local text and turn-based voice chat;
- simple local model setup;
- character images, prompts, first messages, and example dialogue;
- importing and exporting portable character packs;
- compatibility research for Character Card and CharX formats;
- a small set of freely redistributable sample packs.

User accounts, payments, DRM, paid packs, and an official marketplace are not
part of the initial scope. We will first validate that people can create,
share, import, and enjoy packs with the free application.

## Community-first strategy

The application and its pack workflow are intended to remain free. If a
healthy creator and user community develops, optional hosted services may be
added later, such as discovery, managed distribution, updates, creator tools,
or a marketplace. Those services should complement the open local player and
portable pack format rather than make them unusable without a paid account.

## License

Source code in this repository is licensed under the
[Mozilla Public License 2.0](LICENSE).
