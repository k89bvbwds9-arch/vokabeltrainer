# Baut die weitergebbare Anleitung als PDF.
#
# Zielgruppe sind Freunde, Bekannte und Kinder - Leute, die die App nicht
# kennen und kein Interesse an der Technik dahinter haben. Deshalb: kurze
# Saetze, echte Bildschirmfotos statt Beschreibungen, und die eine Frage, an
# der man wirklich haengenbleibt (welche Sprache links, welche rechts), als
# hervorgehobener Kasten.

import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph,
                                Spacer, Image, Table, TableStyle, KeepTogether,
                                PageBreak, Flowable)

HIER = os.path.dirname(os.path.abspath(__file__))
BILDER = os.path.join(HIER, "bilder")
QR = os.path.join(HIER, "vokabeltrainer-qr.png")
ZIEL = os.path.join(HIER, "Vokabeltrainer-Anleitung.pdf")
ADRESSE = "k89bvbwds9-arch.github.io/vokabeltrainer/"

# Arial, weil es Kyrillisch enthaelt - die eingebauten Schriften von reportlab
# nicht, und die Beispiele im Text sind russisch.
pdfmetrics.registerFont(TTFont("Arial", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFont(TTFont("Arial-Bold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))
pdfmetrics.registerFontFamily("Arial", normal="Arial", bold="Arial-Bold")

# Arial kennt die Pfeil- und Zeichensymbole der App nicht - sie kaemen als leere
# Kaestchen heraus. Arial Unicode kennt sie. Es wird deshalb NUR fuer diese
# einzelnen Zeichen benutzt, denn es hat keinen fetten Schnitt.
pdfmetrics.registerFont(TTFont("Symbole", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf"))

def sym(zeichen):
    return f'<font name="Symbole">{zeichen}</font>' 

TON = colors.HexColor("#5b34d6")
TON_HELL = colors.HexColor("#f3efff")
GRAU = colors.HexColor("#5c5c66")
LINIE = colors.HexColor("#dcdce3")
WARN_GRUND = colors.HexColor("#fff6e2")
WARN_RAND = colors.HexColor("#e0a300")

RAND = 18 * mm
BREITE = A4[0] - 2 * RAND


def stil(name, **kw):
    grund = dict(fontName="Arial", fontSize=10.5, leading=15.5, textColor=colors.HexColor("#1a1a1f"),
                 alignment=TA_LEFT, spaceAfter=0)
    grund.update(kw)
    return ParagraphStyle(name, **grund)


S = {
    "titel":      stil("titel", fontName="Arial-Bold", fontSize=30, leading=34, textColor=TON, spaceAfter=4),
    "unter":      stil("unter", fontSize=13, leading=18, textColor=GRAU, spaceAfter=18),
    "kapitel":    stil("kapitel", fontName="Arial-Bold", fontSize=17, leading=21, textColor=TON,
                       spaceBefore=16, spaceAfter=7),
    "abschnitt":  stil("abschnitt", fontName="Arial-Bold", fontSize=12, leading=16, spaceBefore=11, spaceAfter=4),
    "text":       stil("text", spaceAfter=7),
    "klein":      stil("klein", fontSize=9.5, leading=14, textColor=GRAU, spaceAfter=5),
    "mitte":      stil("mitte", alignment=TA_CENTER, textColor=GRAU, fontSize=10, leading=14),
    "adresse":    stil("adresse", fontName="Arial-Bold", fontSize=12.5, leading=17,
                       alignment=TA_CENTER, textColor=TON, spaceAfter=2),
    "schrittzahl": stil("schrittzahl", fontName="Arial-Bold", fontSize=15, leading=17,
                        textColor=colors.white, alignment=TA_CENTER),
    "bildtext":   stil("bildtext", fontSize=9, leading=12.5, textColor=GRAU, alignment=TA_CENTER,
                       spaceBefore=4),
    "kasten":     stil("kasten", fontSize=10.5, leading=15.5, spaceAfter=5),
}


class Trennlinie(Flowable):
    def __init__(self, breite=BREITE, farbe=LINIE, dicke=0.7, oben=6, unten=6):
        super().__init__()
        self.breite, self.farbe, self.dicke = breite, farbe, dicke
        self.oben, self.unten = oben, unten
        self.height = oben + unten

    def wrap(self, *a):
        return (self.breite, self.height)

    def draw(self):
        self.canv.setStrokeColor(self.farbe)
        self.canv.setLineWidth(self.dicke)
        self.canv.line(0, self.unten, self.breite, self.unten)


def schritt(nummer, ueberschrift, text):
    """Eine nummerierte Anweisung mit runder Ziffer links."""
    ziffer = Table([[Paragraph(str(nummer), S["schrittzahl"])]], colWidths=[9 * mm], rowHeights=[9 * mm])
    ziffer.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), TON),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
        ("ROUNDEDCORNERS", [4.5 * mm] * 4),
    ]))
    inhalt = [Paragraph(f"<b>{ueberschrift}</b>", S["abschnitt"])]
    if text:
        inhalt.append(Paragraph(text, S["text"]))
    t = Table([[ziffer, inhalt]], colWidths=[13 * mm, BREITE - 13 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (0, 0), 1), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def kasten(zeilen, grund=TON_HELL, rand=TON, breite=BREITE):
    inhalt = [Paragraph(z, S["kasten"]) for z in zeilen]
    t = Table([[inhalt]], colWidths=[breite])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), grund),
        ("LINEBEFORE", (0, 0), (0, -1), 2.5, rand),
        ("LEFTPADDING", (0, 0), (-1, -1), 9), ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def zugeschnitten(pfad):
    """Leeren Rand unten wegschneiden.

    Der Abfragebildschirm ist per CSS mindestens bildschirmhoch; im
    Bildschirmfoto steht darunter deshalb ein Streifen Weiss, der in der
    Anleitung nur Platz kostet.
    """
    from PIL import Image as PilBild
    ziel = pfad.replace(".png", "-beschnitten.png")
    with PilBild.open(pfad) as b:
        b = b.convert("RGB")
        grund = b.getpixel((2, b.height - 2))
        unten = b.height
        for y in range(b.height - 1, 0, -1):
            zeile = [b.getpixel((x, y)) for x in range(0, b.width, 12)]
            if any(abs(p[0] - grund[0]) + abs(p[1] - grund[1]) + abs(p[2] - grund[2]) > 12
                   for p in zeile):
                unten = min(b.height, y + 14)
                break
        if unten < b.height - 4:
            b.crop((0, 0, b.width, unten)).save(ziel)
            return ziel
    return pfad


def bild(datei, breite_mm, text=None):
    pfad = zugeschnitten(os.path.join(BILDER, datei))
    from PIL import Image as PilBild
    with PilBild.open(pfad) as b:
        w, h = b.size
    breite = breite_mm * mm
    ib = Image(pfad, width=breite, height=breite * h / w)
    ib.hAlign = "CENTER"
    if not text:
        return ib
    return KeepTogether([ib, Paragraph(text, S["bildtext"])])


def bild_neben_text(datei, breite_mm, absaetze):
    """Bildschirmfoto links, Erklaerung rechts - spart Platz und liest sich gut."""
    from PIL import Image as PilBild
    pfad = zugeschnitten(os.path.join(BILDER, datei))
    with PilBild.open(pfad) as b:
        w, h = b.size
    breite = breite_mm * mm
    ib = Image(pfad, width=breite, height=breite * h / w)
    rechts = [Paragraph(a, S["text"]) for a in absaetze]
    t = Table([[ib, rechts]], colWidths=[breite + 6 * mm, BREITE - breite - 6 * mm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, 0), 6 * mm),
        ("RIGHTPADDING", (1, 0), (1, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return t


def fusszeile(canv, doc):
    canv.saveState()
    canv.setFont("Arial", 8)
    canv.setFillColor(GRAU)
    canv.drawString(RAND, 11 * mm, "Vokabeltrainer – Anleitung")
    canv.drawRightString(A4[0] - RAND, 11 * mm, f"Seite {doc.page}")
    canv.setStrokeColor(LINIE)
    canv.setLineWidth(0.5)
    canv.line(RAND, 15 * mm, A4[0] - RAND, 15 * mm)
    canv.restoreState()


def erste_seite(canv, doc):
    canv.saveState()
    canv.setFillColor(TON)
    canv.rect(0, A4[1] - 12 * mm, A4[0], 12 * mm, stroke=0, fill=1)
    canv.restoreState()
    fusszeile(canv, doc)


# --------------------------------------------------------------------------
inhalt = []
A = inhalt.append

# ===== Seite 1: Titel und Installation =====
A(Spacer(1, 8 * mm))
A(Paragraph("Vokabeltrainer", S["titel"]))
A(Paragraph("Vokabeln lernen, indem du sie einfach abfotografierst. "
            "Läuft komplett auf dem Handy – ohne Anmeldung, ohne Konto, ohne Kosten.", S["unter"]))

qr = Image(QR, width=42 * mm, height=42 * mm)
rechts_vom_qr = [
    Paragraph("<b>So kommst du zur App</b>", S["abschnitt"]),
    Paragraph("Halte die Kamera deines Handys auf den QR-Code – oder tippe die Adresse "
              "von Hand in <b>Safari</b> ein:", S["text"]),
    Paragraph(ADRESSE, S["adresse"]),
    Paragraph("Wichtig: Auf dem iPhone muss es <b>Safari</b> sein. Andere Browser können die "
              "App nicht auf den Startbildschirm legen.", S["klein"]),
]
t = Table([[qr, rechts_vom_qr]], colWidths=[48 * mm, BREITE - 48 * mm])
t.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"),
                       ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (0, 0), 6 * mm),
                       ("TOPPADDING", (0, 0), (-1, -1), 0)]))
A(t)

A(Spacer(1, 7 * mm))
A(Trennlinie())
A(Paragraph("Einmalig einrichten", S["kapitel"]))

A(schritt(1, "Adresse in Safari öffnen",
          "QR-Code scannen oder die Adresse oben eintippen."))
A(schritt(2, "Auf den Startbildschirm legen",
          "Unten auf das Teilen-Symbol tippen (Quadrat mit Pfeil nach oben), dann nach unten "
          "wischen bis <b>„Zum Home-Bildschirm“</b>, antippen und oben rechts mit "
          "<b>„Hinzufügen“</b> bestätigen."))
A(schritt(3, "Ab jetzt das neue Symbol benutzen",
          "Auf dem Startbildschirm liegt jetzt ein Symbol namens <b>Vokabeln</b>. "
          "Öffne die App immer darüber, nicht mehr über Safari."))

A(Spacer(1, 3 * mm))
A(kasten([
    "<b>Warum Schritt 3 wichtig ist</b>",
    "Nur so merkt sich das Handy deine Vokabeln dauerhaft. Öffnest du die App immer nur als "
    "normale Internetseite, kann das Handy die gespeicherten Vokabeln irgendwann von selbst "
    "wegräumen.",
]))

A(Spacer(1, 5 * mm))
A(Paragraph("Beim allerersten Foto lädt die App einmalig etwa 10 MB nach (die Texterkennung). "
            "Das dauert je nach Verbindung eine halbe bis eine Minute – <b>nur dieses eine Mal</b>. "
            "Danach funktioniert alles auch ohne Internet, sogar im Flugzeug.", S["klein"]))

A(PageBreak())

# ===== Seite 2: Vokabeln hinzufuegen =====
A(Paragraph("Vokabeln hinzufügen", S["kapitel"]))
A(Paragraph("Du brauchst ein Bild, auf dem Vokabeln mit ihrer Übersetzung stehen – ein Foto aus "
            "dem Vokabelheft, aus dem Schulbuch oder ein Bildschirmfoto aus einer anderen "
            "Lern-App.", S["text"]))

A(bild_neben_text("2-hinzufuegen.png", 60, [
    "Tippe unten auf <b>Hinzufügen</b>.",
    "Oben stellst du ein, um welche zwei Sprachen es geht. Dann <b>Foto auswählen</b> – du kannst "
    "direkt fotografieren oder ein Bild aus deinen Fotos nehmen.",
    "Mit dem Doppelpfeil <b>" + sym("⇄") + "</b> in der Mitte tauschst du die beiden Sprachen.",
]))

A(Spacer(1, 4 * mm))
A(kasten([
    "<b>Welche Sprache gehört links, welche rechts?</b>",
    "<b>Links</b> steht die Sprache, die du <b>lernst</b> – also die fremde.",
    "<b>Rechts</b> steht deine <b>eigene</b> Sprache, die Übersetzung.",
    "Beispiel: Du lernst Russisch und sprichst Deutsch → links <b>Russisch</b>, rechts "
    "<b>Deutsch</b>. Für Italienisch entsprechend links <b>Italienisch</b>, rechts <b>Deutsch</b>.",
    "Das hat zwei Auswirkungen: Auf den Lernkarten steht die linke Sprache oben und fett – und "
    "vorgelesen wird immer nur die linke. Vertauschst du es, liest die App dir deine eigene "
    "Sprache vor, was beim Lernen nichts bringt.",
]))

A(Spacer(1, 4 * mm))
A(Paragraph("Du kannst mehrere Sprachpaare gleichzeitig führen, zum Beispiel Russisch–Deutsch und "
            "Italienisch–Deutsch. Jede Vokabel bleibt ihrem Paar zugeordnet; beim Abfragen steht "
            "auf jeder Karte, worum es gerade geht.", S["text"]))

A(Spacer(1, 3 * mm))
A(Spacer(1, 2 * mm))
A(Paragraph("Welche Bilder funktionieren gut?", S["abschnitt"]))
A(Paragraph("Am besten sind <b>Bildschirmfotos</b> aus anderen Lern-Apps: gestochen scharf, "
            "gerade Zeilen. Fotos von Buchseiten gehen auch – dann möglichst gerade von oben "
            "fotografieren, bei gutem Licht und ohne Schatten auf der Seite.", S["text"]))
A(Paragraph("<b>Handschrift kann die App nicht lesen.</b> Eigene Notizen aus dem Heft tippst du "
            "über <b>Von Hand eingeben</b> ein – das öffnet dieselbe Liste mit leeren Feldern.",
            S["text"]))

A(PageBreak())

# ===== Seite 3: Bestaetigen =====
A(Paragraph("Kurz prüfen, dann übernehmen", S["kapitel"]))
A(Paragraph("Nach ein paar Sekunden zeigt die App, was sie auf dem Bild gelesen hat. "
            "<b>Diesen Schritt bitte nicht überspringen</b> – Texterkennung macht Fehler, und was "
            "hier falsch steht, lernst du sonst wochenlang falsch.", S["text"]))

A(bild_neben_text("3-bestaetigen.png", 46, [
    "<b>Jedes Feld ist antippbar</b> und lässt sich verbessern.",
    "<b>Gelb umrandete Zeilen</b> sind die, bei denen sich die Erkennung selbst unsicher war. "
    "Die lohnt sich anzuschauen.",
    "<b>" + sym("⇅") + "</b> vertauscht Vokabel und Übersetzung in dieser einen Zeile, falls sie verdreht sind.",
    "<b>" + sym("✕") + "</b> wirft eine Zeile weg, die du nicht brauchst.",
    "<b>Grau und abgehakt</b> heißt: Diese Vokabel hast du schon. Sie wird nicht doppelt "
    "angelegt.",
    "Zum Schluss <b>Übernehmen</b>.",
]))

A(Spacer(1, 4 * mm))
A(kasten([
    "<b>Tipp für bessere Erkennung</b>",
    "Wenn du ein Bildschirmfoto aus einer anderen App machst: vorher so scrollen, dass die "
    "oberste Zeile vollständig zu sehen ist und nicht halb unter der Kopfzeile klemmt. "
    "Halb verdeckte Zeilen werden sonst manchmal übersehen.",
], grund=WARN_GRUND, rand=WARN_RAND))

A(PageBreak())

# ===== Seite 4: Lernen =====
A(Paragraph("Lernen", S["kapitel"]))

A(bild_neben_text("4-karte.png", 58, [
    "Tippe unten auf <b>Lernen</b> und dann auf <b>Los geht’s</b>. Du bekommst fünf Vokabeln – "
    "das dauert weniger als eine Minute.",
    "Ein Wort erscheint. Überlege dir die Übersetzung, dann <b>tippe auf die Karte</b>: Die "
    "Lösung erscheint.",
    "Jetzt bist du ehrlich zu dir selbst und tippst <b>Gewusst</b> oder <b>Nicht gewusst</b>.",
    "Das <b>Lautsprechersymbol</b> liest das fremdsprachige Wort vor. Wird von der eigenen "
    "Sprache aus gefragt, erscheint es erst nach dem Aufdecken – sonst wäre es ja verraten.",
]))

A(Spacer(1, 4 * mm))
A(Paragraph("Wann kommt eine Vokabel wieder?", S["abschnitt"]))
A(Paragraph("Die App bringt jede Vokabel genau dann zurück, wenn du sie fast vergessen hättest. "
            "Das ist der Moment, in dem Wiederholen am meisten bringt.", S["text"]))

tab = Table([
    [Paragraph("<b>Gewusst</b>", S["text"]),
     Paragraph("Die Vokabel kommt erst nach <b>1 Tag</b> wieder, dann nach 3, 7, 16 und "
               "35 Tagen. Danach ruht sie und taucht nur noch alle paar Monate zur Kontrolle auf.",
               S["text"])],
    [Paragraph("<b>Nicht gewusst</b>", S["text"]),
     Paragraph("Zurück auf Anfang: morgen wieder dran – und einmal noch am Ende der laufenden "
               "Runde.", S["text"])],
], colWidths=[32 * mm, BREITE - 32 * mm])
tab.setStyle(TableStyle([
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("LINEBELOW", (0, 0), (-1, -2), 0.5, LINIE),
    ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
]))
A(tab)

A(Spacer(1, 3 * mm))
A(Paragraph("Einfach so üben, ohne dass es zählt", S["abschnitt"]))
A(Paragraph("Unter <b>Frei üben, ohne Wertung</b> suchst du dir aus, was du durchgehen willst: "
            "alles, nur die zuletzt nicht gewussten, oder gezielt eine der Abstandsgruppen. "
            "Der Merkstand bleibt dabei unberührt – du kannst also so oft üben, wie du magst, "
            "ohne den Plan durcheinanderzubringen.", S["text"]))

A(Spacer(1, 2 * mm))
A(Paragraph("Jede Vokabel wird übrigens <b>in beide Richtungen</b> abgefragt und getrennt "
            "gezählt. Dass dir bei „сейчас“ das Wort „jetzt“ einfällt, heißt ja nicht, dass dir "
            "umgekehrt „сейчас“ einfällt.", S["text"]))

A(Spacer(1, 2 * mm))
A(Paragraph("Sind mehr Vokabeln dran, als in eine Runde passen, fragt die App danach, ob du "
            "weitermachen willst. Du entscheidest, wann Schluss ist.", S["klein"]))

A(PageBreak())

# ===== Seite 5: Verwalten und Sichern =====
A(Paragraph("Vokabeln verwalten und sichern", S["kapitel"]))

A(bild_neben_text("5-vokabeln.png", 46, [
    "Unter <b>Vokabeln</b> siehst du oben deinen Fortschritt, darunter alle Einträge.",
    "Die <b>Punkte</b> neben jeder Vokabel zeigen, wie fest sie schon sitzt.",
    "<b>" + sym("✎") + "</b> ändert eine Vokabel direkt in der Liste, <b>" + sym("✕") + "</b> löscht sie.",
    "Die <b>Balken</b> zeigen, in welchem Abstand eine Vokabel gerade wiederkommt – nicht, wann "
    "sie das nächste Mal dran ist. „Anfang“ sind Vokabeln, die zuletzt nicht saßen.",
    "Über das Suchfeld findest du jede Vokabel wieder.",
]))

A(Spacer(1, 4 * mm))
A(kasten([
    "<b>Bitte ab und zu sichern</b>",
    "Deine Vokabeln liegen <b>nur auf diesem Handy</b> – das ist der Preis dafür, dass es kein "
    "Konto und keine Anmeldung braucht.",
    "Unter <b>Vokabeln → Einstellungen und Sicherung → Sichern</b> legst du eine Sicherungsdatei "
    "an; wähle dabei <b>„In Dateien sichern“</b>. Über <b>Wiederherstellen</b> holst du sie "
    "zurück – auch auf einem neuen Handy.",
    "Löschst du das App-Symbol vom Startbildschirm, sind die Vokabeln weg. Mit einer Sicherung "
    "ist das halb so wild.",
], grund=WARN_GRUND, rand=WARN_RAND))

A(PageBreak())
A(Paragraph("Gut zu wissen", S["kapitel"]))

for frage, antwort in [
    ("Kostet die App etwas?",
     "Nein. Keine Kosten, keine Werbung, keine Anmeldung."),
    ("Wohin gehen meine Daten?",
     "Nirgendwohin. Fotos, Vokabeln und Lernstand bleiben auf dem Handy. Sie werden nirgends "
     "hochgeladen – auch die Texterkennung läuft im Gerät."),
    ("Funktioniert das ohne Internet?",
     "Ja, nach dem ersten Foto. Nur beim allerersten Mal wird kurz etwas nachgeladen."),
    ("Muss ich Updates installieren?",
     "Nein. Die App holt sich Verbesserungen beim Öffnen von selbst. Deine Vokabeln bleiben dabei "
     "erhalten."),
    ("Geht das auch auf Android?",
     "Ja. In Chrome die Adresse öffnen, dann über das Menü „Zum Startbildschirm hinzufügen“."),
    ("Welche Sprachen gibt es?",
     "17: Deutsch, Englisch, Russisch, Französisch, Italienisch, Spanisch, Portugiesisch, "
     "Niederländisch, Polnisch, Tschechisch, Schwedisch, Dänisch, Türkisch, Griechisch, "
     "Ukrainisch, Arabisch und Hebräisch."),
    ("Wie gut erkennt die App den Text?",
     "Bei sauberen Bildschirmfotos sehr gut – gemessen wurden 94 von 100 Vokabeln zeichengenau. "
     "Bei abfotografierten Buchseiten und bei Sprachen mit anderer Schrift wird häufiger eine "
     "Korrektur nötig. Handschrift kann die App nicht lesen."),
]:
    # Frage und Antwort duerfen nicht durch einen Seitenumbruch getrennt werden -
    # eine Ueberschrift allein am Seitenfuss liest sich wie ein Fehler.
    A(KeepTogether([Paragraph(f"<b>{frage}</b>", S["abschnitt"]),
                    Paragraph(antwort, S["text"])]))

A(Spacer(1, 6 * mm))
A(Trennlinie())
A(Paragraph(f"Viel Erfolg beim Lernen!   ·   {ADRESSE}", S["mitte"]))

# --------------------------------------------------------------------------
doc = BaseDocTemplate(ZIEL, pagesize=A4,
                      leftMargin=RAND, rightMargin=RAND,
                      topMargin=20 * mm, bottomMargin=20 * mm,
                      title="Vokabeltrainer – Anleitung",
                      author="Vokabeltrainer",
                      subject="Anleitung zum Vokabeltrainer")
rahmen = Frame(RAND, 20 * mm, BREITE, A4[1] - 40 * mm, id="haupt",
               leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
doc.addPageTemplates([
    PageTemplate(id="erste", frames=[rahmen], onPage=erste_seite),
    PageTemplate(id="weitere", frames=[rahmen], onPage=fusszeile),
])
doc.build(inhalt)
print("geschrieben:", ZIEL)
