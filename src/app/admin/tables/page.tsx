'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, Search, Settings2, Armchair } from 'lucide-react';
import { tablesApi } from '@/lib/api-client';
import { toast } from 'sonner';
import { useSocket } from '@/components/providers/socket-provider';
import { SOCKET_EVENTS } from '@/lib/constants';

interface TableView {
  _id: string;
  tableNumber: number;
  chairsTop: number;
  chairsBottom: number;
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
  overflowSeats: number;
}

interface TablesSummary {
  totalTables: number;
  totalSeats: number;
  occupiedSeats: number;
  availableSeats: number;
}

const DEFAULT_NEW_TABLE_CHAIRS = 2;
const MAX_TABLES = 200;
const MAX_CHAIRS_PER_SIDE = 20;
const ORDER_EVENTS = [
  SOCKET_EVENTS.ORDER_CREATED,
  SOCKET_EVENTS.ORDER_UPDATED,
  SOCKET_EVENTS.ORDER_COMPLETED,
  SOCKET_EVENTS.ORDER_PAID,
  SOCKET_EVENTS.ORDER_DELETED,
  SOCKET_EVENTS.ORDER_ITEM_DELIVERED,
] as const;

function ChairSeat({ occupied }: { occupied: boolean }) {
  return (
    <div
      className={`h-12 w-12 rounded-xl border shadow-sm flex items-center justify-center ${
        occupied
          ? 'border-red-300 bg-red-50 text-red-600'
          : 'border-green-300 bg-green-50 text-green-600'
      }`}
      aria-hidden
    >
      <Armchair className="h-6 w-6" />
    </div>
  );
}

function ChairRow({
  chairsCount,
  occupiedSeats,
  offset,
}: {
  chairsCount: number;
  occupiedSeats: number;
  offset: number;
}) {
  if (chairsCount <= 0) {
    return <p className="text-xs text-gray-400">No chairs configured</p>;
  }

  return (
    <div className="flex items-center justify-center gap-1.5 flex-wrap">
      {Array.from({ length: chairsCount }, (_, index) => {
        const seatNo = offset + index + 1;
        return <ChairSeat key={seatNo} occupied={seatNo <= occupiedSeats} />;
      })}
    </div>
  );
}

function DiningTableVisual() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <div className="relative overflow-hidden rounded-2xl border border-amber-700/50 bg-gradient-to-b from-amber-200 to-amber-400 px-4 py-4 shadow-sm">
        <div className="pointer-events-none absolute inset-x-6 top-2 h-px bg-amber-50/70" />
        <div className="pointer-events-none absolute inset-x-6 bottom-2 h-px bg-amber-800/20" />
        <div className="pointer-events-none absolute left-0 top-0 h-full w-5 bg-amber-800/10" />
        <div className="pointer-events-none absolute right-0 top-0 h-full w-5 bg-amber-800/10" />
        <p className="relative text-center text-sm font-semibold tracking-wide text-amber-900">
          Dining Table
        </p>
      </div>
    </div>
  );
}

export default function TablesPage() {
  const { socket } = useSocket();
  const [tables, setTables] = useState<TableView[]>([]);
  const [summary, setSummary] = useState<TablesSummary | null>(null);
  const [tableSearch, setTableSearch] = useState('');
  const [partySizeInput, setPartySizeInput] = useState('');
  const [mappingTableInput, setMappingTableInput] = useState('');
  const [mappingTopInput, setMappingTopInput] = useState('');
  const [mappingBottomInput, setMappingBottomInput] = useState('');
  const [totalTablesInput, setTotalTablesInput] = useState('');
  const [defaultChairsTopInput, setDefaultChairsTopInput] = useState(
    String(DEFAULT_NEW_TABLE_CHAIRS)
  );
  const [defaultChairsBottomInput, setDefaultChairsBottomInput] = useState(
    String(DEFAULT_NEW_TABLE_CHAIRS)
  );
  const [savingTableNumber, setSavingTableNumber] = useState<number | null>(null);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingLive, setIsRefreshingLive] = useState(false);

  const fetchTables = useCallback(async (liveRefresh = false) => {
    try {
      if (liveRefresh) {
        setIsRefreshingLive(true);
      } else {
        setIsLoading(true);
      }

      const response = await tablesApi.getAll();
      const fetchedTables = response.data.tables.sort((a, b) => a.tableNumber - b.tableNumber);

      setTables(fetchedTables);
      setSummary(response.data.summary);
      setTotalTablesInput(String(response.data.summary.totalTables));
      setMappingTableInput((prev) => {
        if (prev.trim().length > 0) return prev;
        const firstTable = fetchedTables[0];
        if (!firstTable) return '';
        setMappingTopInput(String(firstTable.chairsTop));
        setMappingBottomInput(String(firstTable.chairsBottom));
        return String(firstTable.tableNumber);
      });
    } catch (error) {
      if (!liveRefresh) {
        toast.error(error instanceof Error ? error.message : 'Failed to load tables');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshingLive(false);
    }
  }, []);

  useEffect(() => {
    fetchTables(false);
  }, [fetchTables]);

  useEffect(() => {
    if (!socket) return;

    const refresh = () => {
      fetchTables(true);
    };

    for (const eventName of ORDER_EVENTS) {
      socket.on(eventName, refresh);
    }

    return () => {
      for (const eventName of ORDER_EVENTS) {
        socket.off(eventName, refresh);
      }
    };
  }, [fetchTables, socket]);

  const filteredTables = useMemo(() => {
    const trimmed = tableSearch.trim();
    if (!trimmed) return tables;
    const tableNumber = Number(trimmed);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) return [];
    return tables.filter((table) => table.tableNumber === tableNumber);
  }, [tableSearch, tables]);

  const canSaveConfig = useMemo(() => {
    return totalTablesInput.trim().length > 0 && !isSavingConfig;
  }, [isSavingConfig, totalTablesInput]);
  const hasSearchFilter = tableSearch.trim().length > 0;
  const selectedSearchTableNumber = useMemo(() => {
    const parsed = Number(tableSearch);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }, [tableSearch]);
  const partySize = useMemo(() => {
    const parsed = Number(partySizeInput);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  }, [partySizeInput]);
  const hasPartySizeInput = partySizeInput.trim().length > 0;
  const suggestedTables = useMemo(() => {
    if (!partySize) {
      return [...tables]
        .sort((a, b) => b.availableSeats - a.availableSeats || a.tableNumber - b.tableNumber)
        .slice(0, 8);
    }

    return [...tables]
      .filter((table) => table.availableSeats >= partySize)
      .sort(
        (a, b) =>
          a.availableSeats - partySize - (b.availableSeats - partySize) ||
          a.tableNumber - b.tableNumber
      )
      .slice(0, 8);
  }, [partySize, tables]);
  const selectedMappingTable = useMemo(() => {
    const tableNumber = Number(mappingTableInput);
    if (!Number.isInteger(tableNumber) || tableNumber <= 0) return null;
    return tables.find((table) => table.tableNumber === tableNumber) || null;
  }, [mappingTableInput, tables]);
  const mappingTotalChairs =
    Math.max(0, Number(mappingTopInput || 0)) + Math.max(0, Number(mappingBottomInput || 0));

  const handleConfigInput = (
    event: React.ChangeEvent<HTMLInputElement>,
    setValue: (value: string) => void
  ) => {
    const value = event.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setValue(value);
    }
  };

  const handleMappingTableInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value !== '' && !/^\d+$/.test(value)) return;

    setMappingTableInput(value);
    if (value === '') return;

    const tableNumber = Number(value);
    const table = tables.find((item) => item.tableNumber === tableNumber);
    if (!table) return;

    setMappingTopInput(String(table.chairsTop));
    setMappingBottomInput(String(table.chairsBottom));
  };
  const handleQuickSelectTable = (tableNumber: number) => {
    setTableSearch(String(tableNumber));
  };

  const handleSaveTableCount = async () => {
    const totalTables = Number(totalTablesInput);
    const defaultChairsTop = Number(defaultChairsTopInput || DEFAULT_NEW_TABLE_CHAIRS);
    const defaultChairsBottom = Number(defaultChairsBottomInput || DEFAULT_NEW_TABLE_CHAIRS);

    if (!Number.isInteger(totalTables) || totalTables < 1 || totalTables > MAX_TABLES) {
      toast.error(`Total tables must be between 1 and ${MAX_TABLES}`);
      return;
    }

    if (
      !Number.isInteger(defaultChairsTop) ||
      !Number.isInteger(defaultChairsBottom) ||
      defaultChairsTop < 0 ||
      defaultChairsBottom < 0 ||
      defaultChairsTop > MAX_CHAIRS_PER_SIDE ||
      defaultChairsBottom > MAX_CHAIRS_PER_SIDE
    ) {
      toast.error(`Default chairs per side must be between 0 and ${MAX_CHAIRS_PER_SIDE}`);
      return;
    }

    setIsSavingConfig(true);
    try {
      await tablesApi.configure({
        totalTables,
        defaultChairsTop,
        defaultChairsBottom,
      });
      toast.success('Table count updated');
      await fetchTables(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update table count');
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleSaveChairMapping = async () => {
    const tableNumber = Number(mappingTableInput);
    const chairsTop = Number(mappingTopInput);
    const chairsBottom = Number(mappingBottomInput);

    if (!Number.isInteger(tableNumber) || tableNumber <= 0) {
      toast.error('Enter a valid table number');
      return;
    }

    const tableExists = tables.some((table) => table.tableNumber === tableNumber);
    if (!tableExists) {
      toast.error('Table number is not configured');
      return;
    }

    if (
      !Number.isInteger(chairsTop) ||
      !Number.isInteger(chairsBottom) ||
      chairsTop < 0 ||
      chairsBottom < 0 ||
      chairsTop > MAX_CHAIRS_PER_SIDE ||
      chairsBottom > MAX_CHAIRS_PER_SIDE
    ) {
      toast.error(`Chair values must be between 0 and ${MAX_CHAIRS_PER_SIDE}`);
      return;
    }

    setSavingTableNumber(tableNumber);
    try {
      await tablesApi.updateTable(tableNumber, { chairsTop, chairsBottom });
      toast.success(`Table ${tableNumber} updated`);
      await fetchTables(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update chair mapping');
    } finally {
      setSavingTableNumber(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b px-4 py-4 lg:px-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Tables</h1>
            <p className="text-gray-500">Simple table setup and live chair availability</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            {isRefreshingLive && <Loader2 className="w-4 h-4 animate-spin text-orange-500" />}
            <span>Live occupancy refresh</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-gray-50">
        <div className="p-4 lg:p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Total Tables</p>
                <p className="text-3xl font-bold text-gray-800">{summary?.totalTables ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Total Chairs</p>
                <p className="text-3xl font-bold text-gray-800">{summary?.totalSeats ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Occupied Chairs</p>
                <p className="text-3xl font-bold text-red-600">{summary?.occupiedSeats ?? 0}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-500">Available Chairs</p>
                <p className="text-3xl font-bold text-green-600">{summary?.availableSeats ?? 0}</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-orange-500" />
                Table Count Configuration
              </CardTitle>
              <CardDescription>
                Set total tables once. New tables will use the default top and bottom chair values.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="totalTables">Total Tables</Label>
                  <Input
                    id="totalTables"
                    value={totalTablesInput}
                    onChange={(event) => handleConfigInput(event, setTotalTablesInput)}
                    inputMode="numeric"
                    placeholder="e.g., 20"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultChairsTop">Default Top Chairs (new tables)</Label>
                  <Input
                    id="defaultChairsTop"
                    value={defaultChairsTopInput}
                    onChange={(event) => handleConfigInput(event, setDefaultChairsTopInput)}
                    inputMode="numeric"
                    placeholder="e.g., 2"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultChairsBottom">Default Bottom Chairs (new tables)</Label>
                  <Input
                    id="defaultChairsBottom"
                    value={defaultChairsBottomInput}
                    onChange={(event) => handleConfigInput(event, setDefaultChairsBottomInput)}
                    inputMode="numeric"
                    placeholder="e.g., 2"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  className="bg-orange-500 hover:bg-orange-600"
                  onClick={handleSaveTableCount}
                  disabled={!canSaveConfig}
                >
                  {isSavingConfig ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Apply Table Count
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold text-gray-800">Chairs Mapping and Visualization</h2>
            <p className="text-sm text-gray-500">
              Search is available inside Table Visualization to focus on one table.
            </p>
          </div>

          <div className="grid items-start gap-6 xl:grid-cols-12">
            <Card className="xl:col-span-4 h-fit">
              <CardHeader>
                <CardTitle>Chairs Configuration</CardTitle>
                <CardDescription>
                  Enter one table number and map top and bottom chairs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="map-table-number">Table Number</Label>
                    <Input
                      id="map-table-number"
                      value={mappingTableInput}
                      onChange={handleMappingTableInput}
                      inputMode="numeric"
                      placeholder="e.g., 1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="map-top-chairs">Top Chairs</Label>
                      <Input
                        id="map-top-chairs"
                        value={mappingTopInput}
                        onChange={(event) => handleConfigInput(event, setMappingTopInput)}
                        inputMode="numeric"
                        placeholder="e.g., 2"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="map-bottom-chairs">Bottom Chairs</Label>
                      <Input
                        id="map-bottom-chairs"
                        value={mappingBottomInput}
                        onChange={(event) => handleConfigInput(event, setMappingBottomInput)}
                        inputMode="numeric"
                        placeholder="e.g., 2"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{mappingTotalChairs} total chairs</Badge>
                  {mappingTableInput.trim().length > 0 && !selectedMappingTable && (
                    <span className="text-xs text-red-600">Table not configured</span>
                  )}
                  {selectedMappingTable && (
                    <span className="text-xs text-gray-600">
                      Existing map: {selectedMappingTable.chairsTop} top, {selectedMappingTable.chairsBottom} bottom
                    </span>
                  )}
                </div>

                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveChairMapping}
                    disabled={savingTableNumber !== null}
                    className="bg-orange-500 hover:bg-orange-600"
                    size="sm"
                  >
                    {savingTableNumber !== null ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Save Mapping'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-8 h-fit">
              <CardHeader>
                <CardTitle>Table Visualization</CardTitle>
                <CardDescription>
                  Red chairs are occupied and green chairs are available based on live group size.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-white p-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Quick Seat Finder</p>
                      <p className="text-xs text-gray-500">
                        Enter group size to get best-fit tables instantly.
                      </p>
                    </div>
                    <div className="w-full sm:w-36">
                      <Input
                        value={partySizeInput}
                        onChange={(event) => handleConfigInput(event, setPartySizeInput)}
                        placeholder="Group size"
                        inputMode="numeric"
                      />
                    </div>
                  </div>

                  {hasPartySizeInput && !partySize && (
                    <p className="text-xs text-red-600">Enter a valid group size (1 or more).</p>
                  )}

                  {partySize && suggestedTables.length === 0 ? (
                    <p className="text-xs text-red-600">
                      No table currently has {partySize} available chairs.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {suggestedTables.map((table) => (
                        <Button
                          key={`quick-${table._id}`}
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickSelectTable(table.tableNumber)}
                          className={`h-auto px-3 py-2 ${
                            selectedSearchTableNumber === table.tableNumber
                              ? 'border-orange-400 bg-orange-50 text-orange-700'
                              : ''
                          }`}
                        >
                          T{table.tableNumber} - {table.availableSeats} free
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border bg-white p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-gray-800">Availability Board</p>
                    <span className="text-xs text-gray-500">Tap table to focus</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {tables.map((table) => {
                      const canFitGroup = partySize ? table.availableSeats >= partySize : table.availableSeats > 0;
                      const isSelected = selectedSearchTableNumber === table.tableNumber;
                      return (
                        <button
                          key={`board-${table._id}`}
                          type="button"
                          onClick={() => handleQuickSelectTable(table.tableNumber)}
                          className={`rounded-md border px-2 py-2 text-left ${
                            isSelected
                              ? 'border-orange-400 bg-orange-50'
                              : canFitGroup
                                ? 'border-green-300 bg-green-50'
                                : 'border-red-300 bg-red-50'
                          }`}
                        >
                          <p className="text-sm font-semibold text-gray-800">Table {table.tableNumber}</p>
                          <p className={`text-xs font-medium ${canFitGroup ? 'text-green-700' : 'text-red-700'}`}>
                            {table.availableSeats} free
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      value={tableSearch}
                      onChange={(event) => handleConfigInput(event, setTableSearch)}
                      placeholder="Search Table Number"
                      className="pl-9"
                      inputMode="numeric"
                    />
                  </div>
                  {hasSearchFilter && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => setTableSearch('')}>
                      Clear Search
                    </Button>
                  )}
                </div>

                {hasSearchFilter && filteredTables.length > 0 && (
                  <p className="text-sm text-gray-600">
                    Showing only <span className="font-semibold">Table {filteredTables[0].tableNumber}</span>
                  </p>
                )}

                <div className="space-y-4">
                  {filteredTables.length === 0 ? (
                    <p className="text-sm text-gray-500">No table found for this number.</p>
                  ) : (
                    filteredTables.map((table) => {
                      const occupiedForView = Math.min(table.occupiedSeats, table.totalSeats);

                      return (
                        <div
                          key={table._id}
                          className="rounded-lg border bg-white p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-gray-800">Table {table.tableNumber}</p>
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                              {table.occupiedSeats}/{table.totalSeats}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            <p className="text-xs text-gray-500">Top side</p>
                            <ChairRow
                              chairsCount={table.chairsTop}
                              occupiedSeats={occupiedForView}
                              offset={0}
                            />
                          </div>

                          <DiningTableVisual />

                          <div className="space-y-2">
                            <p className="text-xs text-gray-500">Bottom side</p>
                            <ChairRow
                              chairsCount={table.chairsBottom}
                              occupiedSeats={occupiedForView}
                              offset={table.chairsTop}
                            />
                          </div>

                          <p className="text-sm text-gray-600">
                            <span className="text-red-600 font-medium">{table.occupiedSeats} occupied</span>
                            {' | '}
                            <span className="text-green-600 font-medium">{table.availableSeats} available</span>
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
