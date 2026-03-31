"""Shared utilities for service duration and time parsing."""
from datetime import datetime, timedelta


def get_service_duration(shop, service_type: str) -> int:
    """Return the duration in minutes for a given service type and shop config."""
    if service_type == "beard":
        return shop.beard_duration or shop.slot_duration
    elif service_type == "combo":
        return shop.slot_duration + (shop.beard_duration or 15)
    return shop.slot_duration  # "haircut" (default)


def parse_time(time_str: str) -> datetime:
    """Parse an HH:MM string into a datetime object (date portion is ignored)."""
    return datetime.strptime(time_str, "%H:%M")


def times_overlap(start1: str, dur1: int, start2: str, dur2: int) -> bool:
    """Return True if two time ranges overlap. start1/start2 are HH:MM strings."""
    s1 = parse_time(start1)
    e1 = s1 + timedelta(minutes=dur1)
    s2 = parse_time(start2)
    e2 = s2 + timedelta(minutes=dur2)
    return s1 < e2 and s2 < e1
