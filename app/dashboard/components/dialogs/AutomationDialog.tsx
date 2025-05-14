// app/dashboard/components/dialogs/AutomationDialog.tsx

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { AutomationType } from "../../types";
import { formatType } from "../../utils/sampleData";

interface AutomationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AutomationDialog({ open, onOpenChange }: AutomationDialogProps) {
    const [automationType, setAutomationType] = useState<AutomationType>('authentication');
    const [schedule, setSchedule] = useState('daily');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // In a real app, this would create a new automation
        onOpenChange(false);
    };

    const automationTypes: AutomationType[] = [
        'authentication',
        'extraction',
        'compliance',
        'verification',
        'communication'
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Create New Automation</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="name">Name</Label>
                        <Input id="name" placeholder="Enter automation name" required />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Enter automation description"
                            rows={3}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="type">Type</Label>
                        <Select
                            value={automationType}
                            onValueChange={(value) => setAutomationType(value as AutomationType)}
                        >
                            <SelectTrigger id="type">
                                <SelectValue placeholder="Select automation type" />
                            </SelectTrigger>
                            <SelectContent>
                                {automationTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                        {formatType(type)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="schedule">Schedule</Label>
                        <Select value={schedule} onValueChange={setSchedule}>
                            <SelectTrigger id="schedule">
                                <SelectValue placeholder="Select schedule" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                                <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {schedule === 'daily' && (
                        <div className="space-y-2">
                            <Label htmlFor="time">Time</Label>
                            <Input
                                id="time"
                                type="time"
                                defaultValue="08:00"
                            />
                        </div>
                    )}

                    {schedule === 'weekly' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="day">Day</Label>
                                <Select defaultValue="monday">
                                    <SelectTrigger id="day">
                                        <SelectValue placeholder="Select day" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="monday">Monday</SelectItem>
                                        <SelectItem value="tuesday">Tuesday</SelectItem>
                                        <SelectItem value="wednesday">Wednesday</SelectItem>
                                        <SelectItem value="thursday">Thursday</SelectItem>
                                        <SelectItem value="friday">Friday</SelectItem>
                                        <SelectItem value="saturday">Saturday</SelectItem>
                                        <SelectItem value="sunday">Sunday</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="weekly-time">Time</Label>
                                <Input
                                    id="weekly-time"
                                    type="time"
                                    defaultValue="08:00"
                                />
                            </div>
                        </div>
                    )}

                    {schedule === 'monthly' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="day-of-month">Day of Month</Label>
                                <Input
                                    id="day-of-month"
                                    type="number"
                                    min="1"
                                    max="31"
                                    defaultValue="1"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="monthly-time">Time</Label>
                                <Input
                                    id="monthly-time"
                                    type="time"
                                    defaultValue="08:00"
                                />
                            </div>
                        </div>
                    )}

                    {schedule === 'custom' && (
                        <div className="space-y-2">
                            <Label htmlFor="cron">Cron Expression</Label>
                            <Input
                                id="cron"
                                placeholder="* * * * *"
                            />
                            <p className="text-xs text-gray-500">
                                Use cron syntax: minute hour day month day-of-week
                            </p>
                        </div>
                    )}

                    <DialogFooter className="pt-4">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>
                        <Button type="submit">Create Automation</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}