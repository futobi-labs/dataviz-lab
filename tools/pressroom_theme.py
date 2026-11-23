"""Write the Pressroom Power BI themes (pressroom/pressroom-light.json, -dark.json).
Colors mirror pressroom/pressroom.css. Run from the repo root: python3 tools/pressroom_theme.py"""
import json

SCHEMA = "https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.149.json"

MODES = {
    "light": dict(stock="#EBE4D6", paper="#F6F1E7", ink="#1F1C18", ink2="#4F4940", ink3="#655D52", rule="#D8CFBD",
                  stone="#D9D0BF", harbor="#23446B", persimmon="#E9693C",
                  data=["#2A5F99", "#D9572B", "#108A72", "#B07D0A", "#C9567F", "#677A2E", "#7563B8", "#A8542F"],
                  good="#2F7D32", neutral="#B7791F", bad="#B3261E"),
    "dark": dict(stock="#12110F", paper="#1D1B18", ink="#EFE8DA", ink2="#C4BBA9", ink3="#958C7C", rule="#34302A",
                 stone="#2A2722", harbor="#284C78", persimmon="#D8673C",
                 data=["#5B8FD0", "#E2693A", "#2AA88D", "#B8870F", "#D46A92", "#8AA04A", "#8A78D2", "#C8754F"],
                 good="#5FB064", neutral="#D9A441", bad="#EC6A5E"),
}

def solid(c): return {"solid": {"color": c}}

def theme(mode):
    m = MODES[mode]
    return {
        "$schema": SCHEMA,
        "name": f"Pressroom ({mode})",
        "dataColors": m["data"],
        "firstLevelElements": m["ink"],
        "secondLevelElements": m["ink2"],
        "thirdLevelElements": m["rule"],
        "fourthLevelElements": m["ink3"],
        "background": m["paper"],
        "secondaryBackground": m["stone"],
        "tableAccent": m["data"][0],
        "good": m["good"], "neutral": m["neutral"], "bad": m["bad"],
        # diverging: Persimmon <-> stock <-> Harbor (two poles, neutral middle)
        "minimum": m["persimmon"], "center": m["stock"], "maximum": m["harbor"], "null": m["stone"],
        "textClasses": {
            "callout": {"fontSize": 44, "fontFace": "Segoe UI Light", "color": m["ink"]},
            "title": {"fontSize": 10, "fontFace": "Segoe UI Semibold", "color": m["ink2"]},
            "header": {"fontSize": 12, "fontFace": "Segoe UI Semibold", "color": m["ink"]},
            "label": {"fontSize": 10, "fontFace": "Segoe UI", "color": m["ink3"]},
        },
        "visualStyles": {
            # visuals sit on the textured canvas image: no container fill, no header chrome
            "*": {"*": {
                "background": [{"show": False}],
                "border": [{"show": False}],
                "dropShadow": [{"show": False}],
                "visualHeader": [{"show": False}],
                "title": [{"fontColor": solid(m["ink2"]), "fontSize": 10}],
            }},
            "page": {"*": {
                "background": [{"color": solid(m["paper"]), "transparency": 0}],
                "outspace": [{"color": solid(m["stock"]), "transparency": 0}],
            }},
            # the 2px paper gap between stacked segments
            "columnChart": {"*": {"dataPoint": [{"borderShow": True, "borderColor": solid(m["paper"]), "borderSize": 2}]}},
            "barChart": {"*": {"dataPoint": [{"borderShow": True, "borderColor": solid(m["paper"]), "borderSize": 2}]}},
        },
    }

for mode in MODES:
    with open(f"pressroom/pressroom-{mode}.json", "w") as f:
        json.dump(theme(mode), f, indent=2)
        f.write("\n")
print("wrote pressroom/pressroom-light.json, pressroom/pressroom-dark.json")
