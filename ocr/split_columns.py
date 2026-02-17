def split_into_columns(img, cols=3):
    h, w = img.shape[:2]
    col_width = w // cols

    columns = []
    for i in range(cols):
        x1 = i * col_width
        x2 = (i + 1) * col_width
        columns.append(img[:, x1:x2])

    return columns
