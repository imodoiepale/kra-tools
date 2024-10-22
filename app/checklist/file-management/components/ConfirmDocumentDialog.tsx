// @ts-nocheck
"use client"

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { XCircle } from "lucide-react";

export default function ConfirmDocumentDialog({ companyName, year, month, kraPin, onConfirm }) {
    const [date, setDate] = useState(new Date());
    const [time, setTime] = useState('');

    const handleConfirm = () => {
        onConfirm({ receivedAt: `${date.toISOString().split('T')[0]} ${time}` }, kraPin);
    };

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                    <XCircle className="h-4 w-4 text-red-500" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Confirm Document Receipt - {companyName}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <DatePicker date={date} setDate={setDate} />
                    <TimePicker value={time} onChange={setTime} />
                    <Button onClick={handleConfirm}>Confirm Receipt</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}