def segment_into_blocks(lines, min_block_size=2):
    blocks = []
    current = []

    for line in lines:
        current.append(line)

        # heuristic: team blocks have 3–4 players
        if len(current) >= 4:
            blocks.append(current)
            current = []

    if len(current) >= min_block_size:
        blocks.append(current)

    return blocks
