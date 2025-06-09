"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Settings, ArrowRightLeft } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface JoinConditionBuilderProps {
  availableTables: any[]
  selectedDataSources: any[]
  joinConditions: any[]
  setJoinConditions: (conditions: any[]) => void
}

export function JoinConditionBuilder({
  availableTables,
  selectedDataSources,
  joinConditions,
  setJoinConditions,
}: JoinConditionBuilderProps) {
  const [isAddingCondition, setIsAddingCondition] = useState(false)
  const [leftSourceId, setLeftSourceId] = useState("")
  const [rightSourceId, setRightSourceId] = useState("")
  const [leftField, setLeftField] = useState("")
  const [rightField, setRightField] = useState("")
  const [joinType, setJoinType] = useState<"inner" | "left" | "right">("inner")
  const [editingConditionId, setEditingConditionId] = useState<string | null>(null)

  // Get fields for a data source
  const getSourceFields = (sourceId: string) => {
    const source = selectedDataSources.find((s) => s.id === sourceId)
    if (!source) return []

    const tableConfig = availableTables.find((t) => t.id === source.tableId)
    if (!tableConfig) return []

    return Object.keys(tableConfig.schema).map((field) => ({
      field,
      type: tableConfig.schema[field],
    }))
  }

  // Add a join condition
  const addJoinCondition = () => {
    if (!leftSourceId || !rightSourceId || !leftField || !rightField) return

    const newCondition = {
      id: editingConditionId || `join_${Date.now()}`,
      leftSourceId,
      rightSourceId,
      leftField,
      rightField,
      joinType,
    }

    if (editingConditionId) {
      // Update existing condition
      setJoinConditions(joinConditions.map((c) => (c.id === editingConditionId ? newCondition : c)))
    } else {
      // Add new condition
      setJoinConditions([...joinConditions, newCondition])
    }

    resetForm()
  }

  // Remove a join condition
  const removeJoinCondition = (conditionId: string) => {
    setJoinConditions(joinConditions.filter((c) => c.id !== conditionId))
  }

  // Edit a join condition
  const editJoinCondition = (condition: any) => {
    setEditingConditionId(condition.id)
    setLeftSourceId(condition.leftSourceId)
    setRightSourceId(condition.rightSourceId)
    setLeftField(condition.leftField)
    setRightField(condition.rightField)
    setJoinType(condition.joinType)
    setIsAddingCondition(true)
  }

  // Reset form
  const resetForm = () => {
    setIsAddingCondition(false)
    setLeftSourceId("")
    setRightSourceId("")
    setLeftField("")
    setRightField("")
    setJoinType("inner")
    setEditingConditionId(null)
  }

  // Get source name by ID
  const getSourceName = (sourceId: string) => {
    const source = selectedDataSources.find((s) => s.id === sourceId)
    if (!source) return "Unknown"

    return source.alias || source.id
  }

  // Get join type display name
  const getJoinTypeDisplay = (type: string) => {
    switch (type) {
      case "inner":
        return "Inner Join"
      case "left":
        return "Left Join"
      case "right":
        return "Right Join"
      default:
        return type
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label>Join Conditions ({joinConditions.length})</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddingCondition(true)}
          disabled={selectedDataSources.length < 2}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Join
        </Button>
      </div>

      {selectedDataSources.length < 2 ? (
        <div className="text-center py-8 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">Add at least two data sources to create joins</p>
        </div>
      ) : joinConditions.length === 0 ? (
        <div className="text-center py-8 border rounded-md bg-muted/20">
          <p className="text-muted-foreground">No join conditions defined</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add join conditions to combine data from multiple sources
          </p>
        </div>
      ) : (
        <ScrollArea className="h-[300px] border rounded-md">
          <div className="p-4 space-y-2">
            {joinConditions.map((condition) => (
              <div key={condition.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        condition.joinType === "inner"
                          ? "bg-blue-100 text-blue-800"
                          : condition.joinType === "left"
                            ? "bg-green-100 text-green-800"
                            : "bg-purple-100 text-purple-800"
                      }
                    >
                      {getJoinTypeDisplay(condition.joinType)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-sm mt-1">
                    <span className="font-medium">{getSourceName(condition.leftSourceId)}</span>
                    <span className="text-muted-foreground">.{condition.leftField}</span>
                    <ArrowRightLeft className="h-3 w-3 mx-1 text-muted-foreground" />
                    <span className="font-medium">{getSourceName(condition.rightSourceId)}</span>
                    <span className="text-muted-foreground">.{condition.rightField}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => editJoinCondition(condition)}>
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => removeJoinCondition(condition.id)}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={isAddingCondition} onOpenChange={setIsAddingCondition}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingConditionId ? "Edit Join Condition" : "Add Join Condition"}</DialogTitle>
            <DialogDescription>Define how data sources should be joined together</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="join-type">Join Type</Label>
              <Select value={joinType} onValueChange={(value) => setJoinType(value as any)}>
                <SelectTrigger id="join-type">
                  <SelectValue placeholder="Select join type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inner">Inner Join</SelectItem>
                  <SelectItem value="left">Left Join</SelectItem>
                  <SelectItem value="right">Right Join</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="left-source">Left Source</Label>
                <Select value={leftSourceId} onValueChange={setLeftSourceId}>
                  <SelectTrigger id="left-source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDataSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        {source.alias || source.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="right-source">Right Source</Label>
                <Select value={rightSourceId} onValueChange={setRightSourceId}>
                  <SelectTrigger id="right-source">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDataSources
                      .filter((s) => s.id !== leftSourceId)
                      .map((source) => (
                        <SelectItem key={source.id} value={source.id}>
                          {source.alias || source.id}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {leftSourceId && rightSourceId && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="left-field">Left Field</Label>
                  <Select value={leftField} onValueChange={setLeftField}>
                    <SelectTrigger id="left-field">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSourceFields(leftSourceId).map((field) => (
                        <SelectItem key={field.field} value={field.field}>
                          {field.field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="right-field">Right Field</Label>
                  <Select value={rightField} onValueChange={setRightField}>
                    <SelectTrigger id="right-field">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {getSourceFields(rightSourceId).map((field) => (
                        <SelectItem key={field.field} value={field.field}>
                          {field.field}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={addJoinCondition} disabled={!leftSourceId || !rightSourceId || !leftField || !rightField}>
              {editingConditionId ? "Update Join" : "Add Join"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
