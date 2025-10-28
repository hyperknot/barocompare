
#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.13"
# dependencies = [
#     "meteostat",
# ]
# ///




from meteostat import Stations

# Get nearby weather stations
stations = Stations()
stations = stations.nearby(47, 18)

station = stations.fetch(10)

# Print DataFrame
print(station)
