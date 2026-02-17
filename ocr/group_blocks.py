def group_by_vertical_position(data, y_threshold=35):
    blocks = []
    current_block = []
    last_y = None

    n = len(data["text"])

    for i in range(n):
        text = data["text"][i].strip()
        if not text:
            continue

        y = data["top"][i]

        if last_y is None:
            current_block.append(text)
        elif abs(y - last_y) <= y_threshold:
            current_block.append(text)
        else:
            blocks.append(current_block)
            current_block = [text]

        last_y = y

    if current_block:
        blocks.append(current_block)

    return blocks
