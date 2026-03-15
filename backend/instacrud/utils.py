def detect_image_type(image_data: bytes) -> str:
    if image_data.startswith(b'\xff\xd8\xff'):
        return "image/jpeg"
    elif image_data.startswith(b'\x89PNG\r\n\x1a\n'):
        return "image/png"
    elif image_data.startswith(b'GIF87a') or image_data.startswith(b'GIF89a'):
        return "image/gif"
    elif image_data.startswith(b'RIFF') and image_data[8:12] == b'WEBP':
        return "image/webp"
    elif image_data.startswith(b'\x00\x00\x00\x0c\x6a\x50\x20\x20') or image_data.startswith(b'\x00\x00\x00\x0cjP  '):
        return "image/jp2"
    elif image_data.startswith(b'BM'):
        return "image/bmp"
    elif image_data.startswith(b'II*\x00') or image_data.startswith(b'MM\x00*'):
        return "image/tiff"
    else:
        # Default to jpeg if unknown
        return "image/jpeg"
