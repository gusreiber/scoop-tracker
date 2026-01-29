<?php

function scoop_bundle_specs(): array {
  return [
    'Cabinet'   => ['needs' => ['cabinet','slot','flavor']],
    'FlavorTub' => ['needs' => ['tub','flavor','use']],
    'Batch'     => ['needs' => ['flavor']],
    'Closeout'  => ['needs' => ['flavor','use']],
  ];
}

function scoop_get_entity_spec_keys(string $bundle_key): array {
  return scoop_bundle_specs()[$bundle_key]['needs'];
}

function scoop_entity_specs(string $key = ''): array {
  $spc = [
    'tub' => [
      'post_type' => 'tub',
      'pod'       => 'tub',
      'title'     => true,
      'fields'    => [
        'state'    => ['data_type' => 'string', 'control' => 'enum'],
        'use'      => ['data_type' => 'int',    'control' => 'find', 'titleMap' => 'use'],
        'amount'   => ['data_type' => 'float',  'control' => 'input'],
        'flavor'   => ['data_type' => 'int',    'control' => 'input', 'titleMap' => 'flavor'],
        'date'     => ['data_type' => 'string', 'control' => 'input'],
        'location' => ['data_type' => 'int',    'control' => 'input', 'titleMap' => 'location', 'hidden' => true],
        'index'    => ['data_type' => 'int',    'hidden'  => true],
      ],
      'post_fields' => [
        'author_name' => 'string',
      ],
      'filter' => function(array $row, array $ctx) {
        return ($row['state'] ?? '') !== 'Emptied';
      },
      'writeable' => ['state','use','amount']
    ],

    'slot' => [
      'post_type' => 'slot',
      'pod'       => 'slot',
      'title'     => true,
      'fields'    => [
        'cabinet'          => ['data_type' => 'int', 'control' => 'find', 'hidden' => true],
        'location'         => ['data_type' => 'int', 'control' => 'find', 'hidden' => true],
        'current_flavor'   => ['data_type' => 'int', 'control' => 'find', 'titleMap' => 'flavor'],
        'immediate_flavor' => ['data_type' => 'int', 'control' => 'find', 'titleMap' => 'flavor'],
        'next_flavor'      => ['data_type' => 'int', 'control' => 'find', 'titleMap' => 'flavor'],
      ],
      'writeable' => ['current_flavor','immediate_flavor','next_flavor'],
    ],

    'cabinet' => [
      'post_type' => 'cabinet',
      'pod'       => 'cabinet',
      'title'     => 'Cabinets',
      'fields'    => [
        'location' => ['data_type' => 'int', 'control' => 'find' ],
        'max_tubs' => ['data_type' => 'int', 'control' => 'find' ],
      ],
      'writeable' => []
    ],

    'flavor' => [
      'post_type' => 'flavor',
      'pod'       => 'flavor',
      'titleMap'  => 'flavor',
      'title'     => 'Flavors',
      'fields'    => [
        // add fields as needed; you can omit tub if you’ll compute from tub list
      ],
      'writeable' => []
    ],

    'use' => [
      'post_type' => 'use',
      'pod'       => 'use',
      'titleMap'  => 'use',
      'title'     => 'Uses',
      'fields'    => [
      'order'     => 'int',
      'titleMap'  => 'use'
      ],
      'writeable' => []
    ],

    'location' => [
      'post_type' => 'location',
      'pod'       => 'location',
      'title'     => 'Locations',
      'titleMap'  => 'location',
      'fields'    => [
        // none needed for now
      ],
      'writeable' => []
    ]
  ];
  
  if ($key === '') return $spc;
  return $spc[$key] ?? [];
}