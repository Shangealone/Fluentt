"""Versioned Tagalog text normalization. Not an answer validator or acoustic score."""
import unicodedata


def normalize(text):
    value = unicodedata.normalize("NFC", text).casefold().replace("’", "'").replace("‘", "'")
    chars = []
    for index, char in enumerate(value):
        category = unicodedata.category(char)
        internal = char in "'-" and index > 0 and index + 1 < len(value) and value[index-1].isalpha() and value[index+1].isalpha()
        chars.append(char if category[0] in "LMN" or internal else " ")
    return " ".join("".join(chars).split())
