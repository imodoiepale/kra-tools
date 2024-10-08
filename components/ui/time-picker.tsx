//@ts-nocheck
"use client"


import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function TimePicker({ value, onChange }) {
    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

    const [hour, minute] = value.split(':');

    const handleHourChange = (newHour) => {
        onChange(`${newHour}:${minute}`);
    };

    const handleMinuteChange = (newMinute) => {
        onChange(`${hour}:${newMinute}`);
    };

    return (
        <div className="flex space-x-2">
            <Select value={hour} onValueChange={handleHourChange}>
                <SelectTrigger className="w-[80px]">
                    <SelectValue placeholder="Hour" />
                </SelectTrigger>
                <SelectContent>
                    {hours.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={minute} onValueChange={handleMinuteChange}>
                <SelectTrigger className="w-[80px]">
                    <SelectValue placeholder="Minute" />
                </SelectTrigger>
                <SelectContent>
                    {minutes.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}