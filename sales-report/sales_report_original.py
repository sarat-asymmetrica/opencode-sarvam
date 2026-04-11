import sys

def process():
    d = {}
    f = open('sales.csv', 'r')
    lines = f.readlines()
    for i in range(len(lines)):
        if i == 0:
            continue
        l = lines[i].strip()
        if l == '':
            continue
        parts = l.split(',')
        if len(parts) < 4:
            continue
        try:
            date = parts[0]
            month = date.split('-')[1]
            cat = parts[1]
            amt = float(parts[3])
        except:
            continue
        if month not in d:
            d[month] = {}
        if cat not in d[month]:
            d[month][cat] = 0
        d[month][cat] = d[month][cat] + amt
    f.close()
    months = sorted(d.keys())
    for m in months:
        print("Month: " + m)
        cats = sorted(d[m].keys())
        for c in cats:
            amt = d[m][c]
            s = "%.2f" % amt
            print("  " + c + ": $" + s)
    return d

def main():
    if len(sys.argv) > 1:
        pass  # unused
    process()

if __name__ == '__main__':
    main()
